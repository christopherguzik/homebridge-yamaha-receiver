# homebridge-yamaha-receiver-scenes

Homebridge plugin for Yamaha network receivers, with **multi-zone control and Scene switches**.

> **This is a fork of [homebridge-yamaha-receiver](https://github.com/nitaybz/homebridge-yamaha-receiver) by [@nitaybz](https://github.com/nitaybz)**, used under its MIT licence. All the core work (zones, inputs, volume, Party/Pure Direct) is theirs. See the [CHANGELOG](CHANGELOG.md) for what this fork changes.

Developed and tested against an **RX-V675** with Main Zone + Zone 2. Other Yamaha YNC-API receivers should work but are untested.

## What you get
- Each zone (Main, Zone 2/3/4) appears as its own TV-style accessory: power, input, volume, mute and the Control Centre remote.
- Optional fan/bulb accessory for a proper volume slider (`volumeAccessory`).
- Optional **Party Mode** and **Pure Direct** switches.
- **Scene switches** (new): a momentary switch per receiver SCENE preset.

## Requirements
- Static IP for the receiver
- "Network Standby" turned on in the receiver
- Node 22.10+ or 24+, Homebridge 1.8+ or 2.x
- **Uninstall `homebridge-yamaha-receiver` first**: both plugins use the `YamahaReceiver` platform alias.

## Install
```
npm install -g homebridge-yamaha-receiver-scenes
```

## Example config
```json
{
  "platform": "YamahaReceiver",
  "statePollingInterval": 10,
  "receivers": [
    {
      "name": "Living",
      "ip": "192.168.1.50",
      "volumeAccessory": "fan",
      "directSwitch": true,
      "sceneSwitches": true,
      "scenes": [
        { "number": 1, "name": "TV" },
        { "number": 2, "name": "Music" },
        { "number": 3, "name": "Movie" },
        { "number": 4, "name": "Alfresco" }
      ],
      "enableZone2": true,
      "zone2MinVolume": -60,
      "zone2MaxVolume": -20
    }
  ]
}
```

### Scenes
Set `sceneSwitches: true`. If `scenes` is omitted you get "Scene 1" to "Scene 4". Scenes are programmed on the receiver itself (SCENE button + front panel/AV Controller app); this plugin only recalls them. The switches are momentary: they flip back off after a second, and HomeKit can't show which scene is active. Recalling a scene powers the receiver on first.

### ARC / TV note
The plugin talks to the receiver over the network, not HDMI-CEC. If your TV turns the receiver on over ARC, HomeKit sees that on the next poll (`statePollingInterval`, minimum 3 s).

### Pairing
Every accessory (each zone, the switches, the scenes) is published as a separate external accessory and has to be added in the Home app with the Homebridge PIN.

## Credits
Original plugin: [nitaybz/homebridge-yamaha-receiver](https://github.com/nitaybz/homebridge-yamaha-receiver). Built on [yamaha-nodejs](https://www.npmjs.com/package/yamaha-nodejs).

## Licence
MIT. See [LICENSE](LICENSE).
