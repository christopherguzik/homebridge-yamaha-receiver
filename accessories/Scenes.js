let Characteristic, Service

// Momentary switches that recall the receiver's built-in SCENE presets.
// All scenes live on a single external accessory (one pairing in the Home app).
class SCENE_SWITCHES {
	constructor(avr, platform, config) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic

		this.avr = avr
		this.log = platform.log
		this.api = platform.api
		this.id = `${config.id}_scenes`
		this.name = `${config.avrName || config.name} Scenes`
		this.serial = this.id
		this.model = config.model || 'unknown'
		this.manufacturer = 'Yamaha'
		this.displayName = this.name
		this.scenes = config.scenes || []

		this.UUID = this.api.hap.uuid.generate(this.id)
		this.log.easyDebug(`Creating New SCENE SWITCHES Accessory: "${this.name}"`)
		this.accessory = new this.api.platformAccessory(this.name, this.UUID)

		try {
			this.setServices()
			this.api.publishExternalAccessories(platform.PLUGIN_NAME, [this.accessory])
		} catch (err) {
			this.log('ERROR setting scene services')
			this.log(err)
		}
	}

	setServices() {
		const informationService = this.accessory.getService(Service.AccessoryInformation)
			|| this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		this.scenes.forEach(scene => {
			const subtype = `scene_${scene.number}`
			const service = this.accessory.addService(Service.Switch, scene.name, subtype)
			service.setCharacteristic(Characteristic.ConfiguredName, scene.name)

			service.getCharacteristic(Characteristic.On)
				.on('get', callback => callback(null, false))
				.on('set', (on, callback) => this.recallScene(scene, service, on, callback))
		})
	}

	async recallScene(scene, service, on, callback) {
		if (!on)
			return callback()

		try {
			this.log(`${this.name} - Recalling "${scene.name}" (Scene ${scene.number})`)
			await this.avr.powerOn()
			await sendScene(this.avr, scene.number)
			callback()
		} catch (err) {
			this.log(`ERROR recalling "${scene.name}": ${err.message || err}`)
			callback(err)
		}

		// momentary: flip back off so it can be triggered again
		setTimeout(() => service.getCharacteristic(Characteristic.On).updateValue(false), 1000)
	}
}

const sendScene = (avr, number) => {
	if (typeof avr.SendXMLToReceiver === 'function') {
		const xml = `<YAMAHA_AV cmd="PUT"><Main_Zone><Scene><Scene_Sel>Scene ${number}</Scene_Sel></Scene></Main_Zone></YAMAHA_AV>`
		return avr.SendXMLToReceiver(xml)
	}
	if (typeof avr.setScene === 'function')
		return avr.setScene(number)
	return Promise.reject(new Error('Scene control is not supported by the installed yamaha-nodejs version'))
}

module.exports = SCENE_SWITCHES
