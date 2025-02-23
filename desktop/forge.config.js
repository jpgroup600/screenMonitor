const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    // Package your app into an ASAR archive
    asar: true,
    // Name for your app (used by Electron Packager)
    name: "ETracker",
    // The executable name (without .exe)
    executableName: "ETracker",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "ETracker",         // Required for Squirrel
        authors: "mrnobo09",    
        exe: "ETracker.exe",
        setupExe: "ETrackerSetup.exe",
        // setupIcon: "./assets/icon.ico", // Uncomment & provide an icon if you have one
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          // Setting the install directory to a location inside /usr so that the package structure is correct
          installDirectory: "/usr/lib/ETracker"
        }
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          // For RPM, use a similar directory inside /usr
          installDirectory: "/usr/lib/ETracker"
        }
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
