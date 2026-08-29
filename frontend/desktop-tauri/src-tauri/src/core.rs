#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityTransition {
    pub ended: Option<String>,
    pub started: Option<String>,
}

#[derive(Debug, Default)]
pub struct ActivityTracker {
    current: Option<String>,
}

impl ActivityTracker {
    pub fn transition(&mut self, next: impl Into<String>) -> ActivityTransition {
        let next = next.into();
        if self.current.as_deref() == Some(next.as_str()) {
            return ActivityTransition {
                ended: None,
                started: None,
            };
        }
        let ended = self.current.replace(next.clone());
        ActivityTransition {
            ended,
            started: Some(next),
        }
    }

    pub fn finish(&mut self) -> Option<String> {
        self.current.take()
    }
}

pub fn scaled_dimensions(width: u32, height: u32, max_width: u32, max_height: u32) -> (u32, u32) {
    if width == 0 || height == 0 {
        return (0, 0);
    }
    let scale = (max_width as f64 / width as f64)
        .min(max_height as f64 / height as f64)
        .min(1.0);
    (
        (width as f64 * scale).round() as u32,
        (height as f64 * scale).round() as u32,
    )
}

pub fn screenshot_file_name(process_id: u32, monitor_index: usize) -> String {
    format!("screen-monitor-{process_id}-{monitor_index}.png")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn activity_transition_starts_changes_and_deduplicates() {
        let mut tracker = ActivityTracker::default();
        assert_eq!(
            tracker.transition("Code.exe"),
            ActivityTransition {
                ended: None,
                started: Some("Code.exe".into())
            }
        );
        assert_eq!(
            tracker.transition("Code.exe"),
            ActivityTransition {
                ended: None,
                started: None
            }
        );
        assert_eq!(
            tracker.transition("chrome.exe"),
            ActivityTransition {
                ended: Some("Code.exe".into()),
                started: Some("chrome.exe".into())
            }
        );
        assert_eq!(tracker.finish(), Some("chrome.exe".into()));
    }

    #[test]
    fn dimensions_never_upscale_and_preserve_ratio() {
        assert_eq!(scaled_dimensions(1920, 1080, 1280, 720), (1280, 720));
        assert_eq!(scaled_dimensions(800, 600, 1280, 720), (800, 600));
        assert_eq!(scaled_dimensions(0, 0, 1280, 720), (0, 0));
    }

    #[test]
    fn screenshot_names_are_unique_for_each_monitor() {
        assert_eq!(screenshot_file_name(42, 0), "screen-monitor-42-0.png");
        assert_eq!(screenshot_file_name(42, 1), "screen-monitor-42-1.png");
        assert_ne!(screenshot_file_name(42, 0), screenshot_file_name(42, 1));
    }
}
