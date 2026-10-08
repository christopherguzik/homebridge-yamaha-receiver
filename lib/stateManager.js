// Run an AVR command, log failures and report them to HomeKit instead of silently succeeding
const run = async function(label, command) {
	try {
		await command()
		return null
	} catch(err) {
		this.log(`${this.name} - ERROR ${label}: ${err && err.message ? err.message : err}`)
		return err
	}
}

// Zone-aware raw command (used for Zone 2/3/4 remote keys, which the library only sends to the main zone)
const zoneXML = function(body) {
	const zoneTag = this.zone === 1 ? 'Main_Zone' : `Zone_${this.zone}`
	return `<YAMAHA_AV cmd="PUT"><${zoneTag}>${body}</${zoneTag}></YAMAHA_AV>`
}

const sendZoneCommand = function(body) {
	if (typeof this.avr.SendXMLToReceiver !== 'function')
		return Promise.reject(new Error('raw commands not supported by installed yamaha-nodejs'))
	return this.avr.SendXMLToReceiver(zoneXML.call(this, body))
}

module.exports = {

	getState: async function() {
		this.log.easyDebug(`${this.name} - Getting State`)
		try {
			const basicInfo = await this.avr.getBasicInfo(this.zone)
			const currentInput = this.inputs.find(input => input.key === basicInfo.getCurrentInput())
			const inputIdentifier = currentInput ? currentInput.identifier : 0

			const state = {
				power: basicInfo.isOn() ? 1 : 0,
				volume: formatVolumeToHK(basicInfo.getVolume(), this.minVolume, this.maxVolume),
				mute: basicInfo.isMuted(),
				source: inputIdentifier
			}
			
			this.log.easyDebug(`${this.name} - Got New State: ${JSON.stringify(state)}`)
			this.cachedStates[this.id] = state
			await this.storage.setItem('cachedStates', this.cachedStates)
			return state

		} catch(err) {
			this.log(`Could NOT get state from "${this.name}" : ${err.message}`)
			// this.log.easyDebug(err)

			if (this.id in this.cachedStates) {
				this.log.easyDebug(`${this.name} - found cached state in storage`)
				return this.cachedStates[this.id]
			} else {
				this.log.easyDebug(`${this.name} - Returning default values -> please check your network connection`)
				return {
					power: 0,
					volume: 0,
					mute: false,
					source: 0
				}
			}
		}
	},

	set: {

		Active: async function(state, callback) {
			let err
			if (state) {
				this.log(`${this.name}  - Turning ON`)
				err = await run.call(this, 'powering on', () => this.avr.powerOn(this.zone))
			} else {
				this.log(`${this.name} - Turning OFF`)
				err = await run.call(this, 'powering off', () => this.avr.powerOff(this.zone))
			}

			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		ActiveIdentifier: async function(identifier, callback) {
			const source = this.inputs.find(input => input.identifier === identifier).key
			this.log(`${this.name} - Setting Source to "${source}"`)

			const err = await run.call(this, `setting source to ${source}`, async () => {
				if (!this.state.power)
					await this.avr.powerOn(this.zone)
				await this.avr.setInputTo(source, this.zone)
			})
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		RemoteKey: async function(key, callback) {
			const RemoteKey = this.api.hap.Characteristic.RemoteKey
			const main = this.zone === 1
			let label, command

			switch (key) {
				case RemoteKey.ARROW_UP:
					label = 'UP'
					command = main ? () => this.avr.remoteCursor('Up') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Up</Cursor></Cursor_Control>')
					break;
				case RemoteKey.ARROW_DOWN:
					label = 'DOWN'
					command = main ? () => this.avr.remoteCursor('Down') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Down</Cursor></Cursor_Control>')
					break;
				case RemoteKey.ARROW_RIGHT:
					label = 'RIGHT'
					command = main ? () => this.avr.remoteCursor('Right') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Right</Cursor></Cursor_Control>')
					break;
				case RemoteKey.ARROW_LEFT:
					label = 'LEFT'
					command = main ? () => this.avr.remoteCursor('Left') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Left</Cursor></Cursor_Control>')
					break;
				case RemoteKey.SELECT:
					label = 'SELECT'
					command = main ? () => this.avr.remoteCursor('Sel') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Sel</Cursor></Cursor_Control>')
					break;
				case RemoteKey.BACK:
					label = 'BACK'
					command = main ? () => this.avr.remoteCursor('Return') : () => sendZoneCommand.call(this, '<Cursor_Control><Cursor>Return</Cursor></Cursor_Control>')
					break;
				case RemoteKey.INFORMATION:
					label = 'MENU'
					command = main ? () => this.avr.remoteMenu('On Screen') : null // no on-screen menu for Zone 2+
					break;
				case RemoteKey.PLAY_PAUSE:
					label = 'PLAY/PAUSE (toggling)'
					command = main
						? () => this.avr.pause().catch(() => this.avr.play())
						: () => sendZoneCommand.call(this, '<Play_Control><Playback>Pause</Playback></Play_Control>')
							.catch(() => sendZoneCommand.call(this, '<Play_Control><Playback>Play</Playback></Play_Control>'))
					break;
				case RemoteKey.FAST_FORWARD:
				case RemoteKey.NEXT_TRACK:
					label = 'SKIP'
					command = main ? () => this.avr.skip() : () => sendZoneCommand.call(this, '<Play_Control><Playback>Skip Fwd</Playback></Play_Control>')
					break;
				case RemoteKey.REWIND:
				case RemoteKey.PREVIOUS_TRACK:
					label = 'REWIND'
					command = main ? () => this.avr.rewind() : () => sendZoneCommand.call(this, '<Play_Control><Playback>Skip Rev</Playback></Play_Control>')
					break;
				default:
			}

			if (!command) {
				callback()
				return
			}

			this.log(`${this.name} - Sending Remote Key: "${label}"`)
			const err = await run.call(this, `remote key ${label}`, command)
			callback(err)
		},

		Volume: async function(volume, callback) {
			this.log(`${this.name} - Setting Volume to ${volume}`)
			const mappedVolume = formatVolumeToYamaha(volume, this.minVolume, this.maxVolume)
			this.log.easyDebug(`${this.name} - Formatted Yamaha Volume: ${mappedVolume}`)
			const err = await run.call(this, 'setting volume', () => this.avr.setVolumeTo(mappedVolume, this.zone))
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		Mute: async function(mute, callback) {
			let err
			if (mute) {
				this.log(`${this.name} - Setting Mute ON`)
				err = await run.call(this, 'muting', () => this.avr.muteOn(this.zone))
			} else if (this.state.mute){
				this.log(`${this.name} - Setting Mute OFF`)
				err = await run.call(this, 'unmuting', () => this.avr.muteOff(this.zone))
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		VolumeSelector: async function(decrement, callback) {
			let err
			if (decrement) {
				this.log(`${this.name} - Decrementing Volume by 1`)
				err = await run.call(this, 'volume down', () => this.avr.volumeDown(10, this.zone))
			} else {
				this.log(`${this.name} - Incrementing Volume by 1`)
				err = await run.call(this, 'volume up', () => this.avr.volumeUp(10, this.zone))
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		ExternalVolume: async function(volume, callback) {
			this.log(`${this.name} (Ext.) - Setting Volume to ${volume}`)
			const mappedVolume = formatVolumeToYamaha(volume, this.minVolume, this.maxVolume)
			this.log.easyDebug(`${this.name} (Ext.) - Formatted Yamaha Volume: ${mappedVolume}`)
			const err = await run.call(this, 'setting volume', () => this.avr.setVolumeTo(mappedVolume, this.zone))

			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		},

		ExternalMute: async function(unmute, callback) {
			let err
			if (!unmute) {
				this.log(`${this.name} (Ext.) - Setting Mute ON`)
				err = await run.call(this, 'muting', () => this.avr.muteOn(this.zone))
			} else if (this.state.mute) {
				this.log(`${this.name} (Ext.) - Setting Mute OFF`)
				err = await run.call(this, 'unmuting', () => this.avr.muteOff(this.zone))
			}
			
			setTimeout(() => {
				this.updateState()
			}, 2000)
			callback(err)
		}
	}
}

const formatVolumeToHK = function(volume, min, max) {
	volume = volume !== 0 ? volume / 10 : 0
	if (volume <= min)
		return 0
	if (volume >= max)
		return 100

	return Math.round(100 * (volume - min) / (max - min))
}


const formatVolumeToYamaha = function(volume, min, max) {
	return Math.round(volume / 100 * (max - min) + min) * 10
}