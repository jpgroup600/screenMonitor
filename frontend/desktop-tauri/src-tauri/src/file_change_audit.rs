use crate::backup_policy::BackupPolicy;
use notify::{event::ModifyKind, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::mpsc::UnboundedSender;

const DEBOUNCE_WINDOW: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileAuditEvent {
    pub event_type: &'static str,
    pub source: PathBuf,
    pub destination: Option<PathBuf>,
}

#[derive(Default)]
struct Debouncer {
    last_seen: HashMap<(String, PathBuf), Instant>,
}

impl Debouncer {
    fn accept(&mut self, event: &FileAuditEvent, now: Instant) -> bool {
        let key = (event.event_type.to_owned(), event.source.clone());
        if self
            .last_seen
            .get(&key)
            .is_some_and(|last| now.duration_since(*last) < DEBOUNCE_WINDOW)
        {
            return false;
        }
        self.last_seen.insert(key, now);
        self.last_seen
            .retain(|_, last| now.duration_since(*last) < Duration::from_secs(60));
        true
    }
}

pub fn start(
    roots: &[String],
    sender: UnboundedSender<FileAuditEvent>,
) -> Result<RecommendedWatcher, String> {
    let policy = BackupPolicy::default();
    let debouncer = Arc::new(Mutex::new(Debouncer::default()));
    let callback_debouncer = debouncer.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
        let Ok(event) = result else { return };
        for audit_event in classify(&event, &policy) {
            let accepted = callback_debouncer
                .lock()
                .map(|mut value| value.accept(&audit_event, Instant::now()))
                .unwrap_or(false);
            if accepted {
                let _ = sender.send(audit_event);
            }
        }
    })
    .map_err(|error| error.to_string())?;

    for root in roots {
        watcher
            .watch(Path::new(root), RecursiveMode::Recursive)
            .map_err(|error| format!("Failed to watch {root}: {error}"))?;
    }
    Ok(watcher)
}

fn classify(event: &Event, policy: &BackupPolicy) -> Vec<FileAuditEvent> {
    if matches!(event.kind, EventKind::Modify(ModifyKind::Name(_))) && event.paths.len() >= 2 {
        let source = &event.paths[0];
        let destination = &event.paths[1];
        if is_allowed_file(source, policy) || is_allowed_file(destination, policy) {
            return vec![FileAuditEvent {
                event_type: "FILE_MOVED",
                source: source.clone(),
                destination: Some(destination.clone()),
            }];
        }
        return Vec::new();
    }

    let event_type = match event.kind {
        EventKind::Create(_) => "FILE_CREATED",
        EventKind::Modify(_) => "FILE_MODIFIED",
        EventKind::Remove(_) => "FILE_DELETED",
        _ => return Vec::new(),
    };
    event
        .paths
        .iter()
        .filter(|path| is_allowed_file(path, policy))
        .map(|path| FileAuditEvent {
            event_type,
            source: path.clone(),
            destination: None,
        })
        .collect()
}

fn is_allowed_file(path: &Path, policy: &BackupPolicy) -> bool {
    if path.is_dir() {
        return false;
    }
    let size = path
        .metadata()
        .ok()
        .filter(|value| value.is_file())
        .map(|value| value.len());
    policy.should_include(path, size)
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, DataChange, ModifyKind, RemoveKind, RenameMode};

    fn event(kind: EventKind, paths: &[&str]) -> Event {
        paths.iter().fold(Event::new(kind), |value, path| {
            value.add_path(PathBuf::from(path))
        })
    }

    #[test]
    fn classifies_file_lifecycle_events() {
        let policy = BackupPolicy::default();
        let created = classify(
            &event(EventKind::Create(CreateKind::File), &[r"C:\Work\a.txt"]),
            &policy,
        );
        let modified = classify(
            &event(
                EventKind::Modify(ModifyKind::Data(DataChange::Any)),
                &[r"C:\Work\a.txt"],
            ),
            &policy,
        );
        let deleted = classify(
            &event(EventKind::Remove(RemoveKind::File), &[r"C:\Work\a.txt"]),
            &policy,
        );
        assert_eq!(created[0].event_type, "FILE_CREATED");
        assert_eq!(modified[0].event_type, "FILE_MODIFIED");
        assert_eq!(deleted[0].event_type, "FILE_DELETED");
    }

    #[test]
    fn pairs_rename_source_and_destination() {
        let policy = BackupPolicy::default();
        let result = classify(
            &event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                &[r"C:\Work\old.txt", r"C:\Work\new.txt"],
            ),
            &policy,
        );
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].event_type, "FILE_MOVED");
        assert_eq!(
            result[0].destination.as_deref(),
            Some(Path::new(r"C:\Work\new.txt"))
        );
    }

    #[test]
    fn hard_excludes_private_paths_before_they_leave_the_device() {
        let policy = BackupPolicy::default();
        let result = classify(
            &event(
                EventKind::Modify(ModifyKind::Any),
                &[r"C:\Users\employee\.ssh\id_rsa"],
            ),
            &policy,
        );
        assert!(result.is_empty());
    }

    #[test]
    fn suppresses_duplicate_events_inside_debounce_window() {
        let mut debouncer = Debouncer::default();
        let item = FileAuditEvent {
            event_type: "FILE_MODIFIED",
            source: PathBuf::from(r"C:\Work\a.txt"),
            destination: None,
        };
        let now = Instant::now();
        assert!(debouncer.accept(&item, now));
        assert!(!debouncer.accept(&item, now + Duration::from_secs(1)));
        assert!(debouncer.accept(&item, now + Duration::from_secs(4)));
    }
}
