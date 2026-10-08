# Changelog

This project is a fork of [homebridge-yamaha-receiver](https://github.com/nitaybz/homebridge-yamaha-receiver) by [@nitaybz](https://github.com/nitaybz) (MIT). Versions below 0.4.0 are the original project's.

## 0.4.0 (fork's first release, based on upstream 0.3.3)

### Added
- **Scene switches** (`sceneSwitches`, `scenes`): one extra accessory with a momentary switch per Yamaha SCENE preset. Defaults to Scene 1-4 (the RX-V675 has four); each can be renamed or remapped in the config.
- Zone 2/3/4 remote keys (arrows, select, back, play/pause, skip) are now sent to the zone they belong to. Previously they always went to the main zone. *(Zone-targeted commands are best effort and need testing per model.)*

### Fixed
- Typo (`zone{N}MaVolume`) that ignored the Zone 2/3/4 minimum volume when a receiver was first set up.
- Commands (power, input, volume, mute, remote keys) are now awaited. A failure is logged and reported to HomeKit ("No Response") instead of always appearing successful, and no longer risks an unhandled promise rejection.

### Changed
- npm package renamed to `homebridge-yamaha-receiver-scenes`. The platform alias is still `YamahaReceiver`, so existing config keeps working, but **uninstall the original plugin first** because both register the same alias.
- Removed upstream donation links from the package and repo; credit is kept in the README and LICENSE.

## Upstream
Earlier history: https://github.com/nitaybz/homebridge-yamaha-receiver/releases
