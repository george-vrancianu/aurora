/// <reference path="../_all.ts" />

module auroraApp.Services {
	export class ComputeService {
		cache:VmItem[] = []
		url:string
		listItems:VmItem[] = []
		vmFlavors:VmFlavor[] = []
		vmImages:VmImage[] = []
		vmVolumes: VmVolume[] = []
		vmSnapshots: VmSnapshot[] = []
		vmNetworks:VmNetwork[] = []
		networks: INetwork[] = []
		ports: IPort[] = []
		networkList:VmNetwork[] = []
		routers: IRouter[]
		subnets: ISubnet[] = []
		keypairs: IKeypair[] = []
		project: Project
		queried:boolean = false
		os_url: string
		initialized: boolean = false
		
		private authenticated:boolean = false
		
		static $inject = [
			"config",
			"HttpWrapService",
			"IdentityService",
			"$q",
			"$cookies",
			"$timeout",
			"LocalStorage"
		]
		
		constructor(private config,
		            private http:Services.IHttpWrapperService,
		            private identity: Services.IIdentityService,
		            private $q:ng.IQService,
		            private $cookies:Services.ICookiesService,
		            private $timeout:ng.ITimeoutService,
								public localStorage: LocalStorage) {
			
			this.os_url = config.OS_URL
		}
		
		init(force = false):ng.IPromise< any >
		{
			let deferred = this.$q.defer()
			if (this.initialized && !force) {
				deferred.resolve(true)
			} else {
				this.$q.all([this.loadImages(), this.loadFlavors()]).then(response => {
					this.$q.all([this.loadServers(), this.getTenantQuota(this.identity.tenant_id)]).then(res => {
						this.initialized = true
						deferred.resolve(true)
						this.loadVolumes()
						this.loadSnapshots()
						this.loadNetworks().then(() => {
							this.loadPorts().then(() => this.loadFloatingIps())
							this.loadRouters()
						})
						this.loadKeypairs()
					})
				})
			}
			return deferred.promise
		}
		
		loadFlavors():ng.IPromise< VmFlavor[] >
		{
			let deferred = this.$q.defer()
			
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/flavors/detail"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				if (response.flavors) {
					this.vmFlavors = []
					angular.forEach(response.flavors, item => {
						let flavor = new VmFlavor(
							item.id,
							item.name,
							item.vcpus,
							item.ram,
							item.disk,
							0,
							item.tags
						)
						this.vmFlavors.push(flavor)
					});
					deferred.resolve(this.vmFlavors)
				} else {
					// TODO: Error handle
				}
			})
			return deferred.promise;
		}
		
		getTenantQuota(tenant_id:string):ng.IPromise< Project >
		{
			let deferred = this.$q.defer()
			
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/os-quota-sets/" + tenant_id
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				if (response.quota_set) {
					let quota = response.quota_set
					let zone:IZone = {id: "nova", name: "nova"}
					this.project = new Project(
						quota.id,
						null,
						quota.instances,
						quota.cores,
						quota.ram,
						-1,
						128000,
						12000,
						"EUR",
						[zone],
						[],
						quota.floating_ips,
						[],
						quota.security_groups,
						[],
						quota.server_groups
					)
					deferred.resolve(this.project)
					console.log("Project:", this.project)
				}
				
			})
			return deferred.promise
		}
		
		getZones():ng.IPromise< any >
		{
			let deferred = this.$q.defer()
			
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/os-availability-zone"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				if (response.availabilityZoneInfo) {
					angular.forEach(response.availabilityZoneInfo, item => {
						this.project.zones.push({id: item.zoneName, name: item.zoneName})
					})
				}
			});
			
			return deferred.promise
		}
		
		getFlavor(id: string): VmFlavor
		{
			let flavor: VmFlavor = null
			this.vmFlavors.forEach(item => {
				if (item.id == id)
					flavor = item
			})
			return flavor
		}
		
		loadImages():ng.IPromise< VmImage[] >
		{
			let endpoint = this.images_endpoint()
			let url = this.os_url + "/glance/v2/images"
			let deferred = this.$q.defer()
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				if (response.images) {
					this.vmImages = []
					angular.forEach(response.images, item => {
						let image = new VmImage(
							item.id,
							item.name,
							'generic',
							'1.0',
							item.size,
							'image',
							item.created_at,
							item.tags
						)
						this.vmImages.push(image)
					})
					deferred.resolve(this.vmImages)
				}
			})
			return deferred.promise;
		}
		
		loadSnapshots():ng.IPromise< VmImage[] >
		{
			let endpoint = this.cinder_endpoint()
			let url = this.os_url + "/cinder/snapshots/detail"
			let deferred = this.$q.defer()
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				/*if (response.images) {
					this.vmImages = []
					angular.forEach(response.images, item => {
						let image = new VmImage(
							item.id,
							item.name,
							'generic',
							'1.0',
							item.size,
							'image',
							item.created_at,
							item.tags
						)
						this.vmImages.push(image)
					})*/
					console.log("SNAPSHOTS RESPONSE", response)
					deferred.resolve(this.vmImages)
				
			})
			return deferred.promise;
		}
		
		loadVolumes():ng.IPromise< VmImage[] >
		{
			let endpoint = this.cinder_endpoint()
			let url = this.os_url + "/cinder/volumes/detail"
			let deferred = this.$q.defer()
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				console.log(response)
				deferred.resolve(response)
				if (response.volumes) {
					this.vmVolumes = []
					angular.forEach(response.volumes, item => {
						this.addVolume(item)
					})
					deferred.resolve(this.vmVolumes)
					console.log(this.vmVolumes)
				}
			})
			return deferred.promise;
		}
		
		addVolume(item) {
			let region:IZone = null
			this.project.zones.forEach((zone:IZone) => {
				if (zone.name == item.availability_zone)
					region = zone
			})
			let attached_to = null
			
			let newVolume = new VmVolume(
				item.id,
				item.display_name,
				item.description,
				item.size,
				item.snapshot_id,
				item.user_id,
				item.attachments,
				null,
				item.status,
				item.volume_type,
				item.links,
				item.migration_status,
				item.region,
				item.bootable,
				item.encrypted,
				region,
				item.metadata,
				[]
			)
			if (newVolume.attachments.length) {
				newVolume.attachments.forEach(attachment => {
					let vm = this.getVm(attachment.server_id)
					attachment.vm = vm
					vm.volumes.push(newVolume)
				})
			}
			let updated = false
			this.vmVolumes.forEach(volume => {
				if (volume.id == newVolume.id) {
					volume = newVolume
					updated = true
				}
			})
			console.log(newVolume)
			if (!updated) {
				this.vmVolumes.push(newVolume)
			}
		}
		
		insertVolume(volumeData) {
			let endpoint = this.cinder_endpoint()
			let url = this.os_url + "/cinder/volumes"
			let deferred = this.$q.defer()
			var payload = {
				volume: {
					size: volumeData.size,
					display_description: volumeData.description,
					display_name: volumeData.name
				}
			}
			this.http.post(
				url,
				payload,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}).then(response => {
					this.addVolume(response.volume)
					deferred.resolve(response)
			})
			return deferred.promise
		}
		
		removeVolume(volume_id) {
			let deleteIndex = null
			this.vmVolumes.forEach((volume, index) => {
				if (volume.id == volume_id) {
					deleteIndex = index
				}
			})
			if (deleteIndex != null) {
				this.vmVolumes.splice(deleteIndex, 1)
			}
		}
		
		deleteVolume(volume_id) {
			let endpoint = this.cinder_endpoint()
			let url = this.os_url + "/cinder/volumes/" + volume_id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				console.log("Volume delete response", response)
				this.removeVolume(volume_id)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		updateVolume(newVolumeData) {
			let endpoint = this.cinder_endpoint()
			let url = this.os_url + "/cinder/volumes/" + newVolumeData.id
			let deferred = this.$q.defer()
			let payload = {
				volume: {
					display_name: newVolumeData.name,
					display_description: newVolumeData.description,
				}
			}
			this.http.put(
				url,
				payload,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				console.log("Volume edit response", response)
				this.addVolume(response.volume)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		attachVolume(volume, vm) {
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/servers/" + vm.id + "/os-volume_attachments"
			let deferred = this.$q.defer()
			
			let payload = {
				"volumeAttachment": {volumeId: volume.id}
			}
			this.http.post(
				url,
				payload,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				volume.attachments.push({
					attachment_id: response.volumeAttachment.id,
					volume_id: response.volumeAttachment.volumeId,
					server_id: response.volumeAttachment.serverId,
				})
				vm.volumes.push(volume)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		detachVolume(volume, instance_uuid)
		{
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/servers/" + instance_uuid + "/os-volume_attachments/" + volume.id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				let index = 0
				volume.attachments.forEach((attachment, vIndex) => {
					if (attachment.server_id == instance_uuid) {
						index = vIndex
					}
				})
				volume.attachments.splice(index, 1)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		
		getImage(id: string): VmImage
		{
			let image: VmImage = null
			this.vmImages.forEach(item => {
				if (item.id == id)
					image = item
			})
			return image
		}
		
		loadServers():ng.IPromise< VmItem[] >
		{
			let deferred = this.$q.defer()
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/detail"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				this.cache = response
				
				if (response.servers) {
					this.listItems = []
					angular.forEach(response.servers, server => this.addServer(server))
				}
				
				deferred.resolve(response)
			});
			
			return deferred.promise
		}
		
		loadServerDetails(vm_id:string):ng.IPromise< VmItem >
		{
			let deferred = this.$q.defer()
			let vm = this.getVm(vm_id)
			/*this.$q.all([this.loadServerPortInterfaces(vm)]).then(response => {
				
			})*/
			deferred.resolve(vm)
			
			return deferred.promise
		}
		
		/**
		 * Adds or updates server if already exists
		 * @param vm
		 */
		addServer(server)
		{
			let updated = false
			let started:Date = new Date(Date.parse(server.updated));
			let newVm = new VmItem(
				this,
				server.id,
				server.name,
				server.status,
				server.created,
				this.getImage(server.image.id),
				[], // networks
				[], // volumes
				this.getFlavor(server.flavor.id),
				server["OS-EXT-AZ:availability_zone"],
				[],
				[],
				started
			)
			
			// search if exists, if so -> update
			this.listItems.forEach(vm => {
				if (vm.id == newVm.id) {
					updated = true
					vm = newVm
				}
			})
			
			// if not updated, push into the collection
			if (!updated) {
				this.listItems.push(newVm)
			}
		}
		
		deleteServer(vm:VmItem):ng.IPromise< any >
		{
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				let index = this.listItems.indexOf(vm)
				this.listItems.splice(index, 1)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		updateServerName(vm: VmItem, name: string):ng.IPromise< boolean >
		{
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id
			let deferred = this.$q.defer()
			let payload = {server: {name: name}}
			
			this.http.put(
				url,
				payload,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				if (response.server) {
					this.addServer(response.server)
				}
			}, response => deferred.resolve(false))
			
			return deferred.promise
		}
		
		loadServerPortInterfaces(vm: VmItem):ng.IPromise< any >
		{
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id + "/os-interface"
			let deferred = this.$q.defer()
			
			this.http.get(
				url,
				{"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}
			).then(response => {
				let network_interfaces = []
				if (response.interfaceAttachments.length) {
					response.interfaceAttachments.forEach(netInterface => {
						netInterface.network = this.getNetwork(netInterface.net_id)
						// TODO: Check if this is ok, picking up first fixed ip
						netInterface.fixed_ips[0].subnet = this.getSubnet(netInterface.fixed_ips[0].subnet_id)
						network_interfaces.push(netInterface)
					})
					vm.ports = network_interfaces
					
					deferred.resolve(vm)
				} else {
					deferred.resolve()
				}
			}, response => deferred.resolve(false))
			
			return deferred.promise
		}
		
		deletePortInterface(vm:VmItem, port:IPort) {
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id + "/os-interface/" + port.id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				let index = vm.ports.indexOf(port)
				vm.ports.splice(index, 1)
				deferred.resolve(true)
			})
			return deferred.promise
		}
		
		loadPorts():ng.IPromise< any > {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/ports"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				this.ports = []
				response.ports.forEach((port:IPort) => {
					this.addPort(port)
				}, this)
				deferred.resolve(this.ports)
			})
			
			return deferred.promise
		}
		
		addPort(port:IPort) {
			if (port.device_owner.indexOf("compute") > -1) {
				let vm = this.getVm(port.device_id)
				if (vm) {
					vm.ports.push(port)
				}
				port.device = vm
				port.network = this.getNetwork(port.network_id)
			}
			this.ports.push(port)
		}
		
		/**
		 * Set state of VM
		 */
		setVmState(vm:VmItem, state:string):ng.IPromise< boolean > {
			let payload
			switch (state) {
				case "RESUME":
					payload = {"resume": null}
					break;
				case "REBOOT":
					payload = {"reboot": {"type": "HARD"}}
					break;
				case "PAUSE":
					payload = {"pause": null}
					break;
				case "UNPAUSE":
					payload = {"unpause": null}
					break;
				case "START":
					payload = {"os-start" : null}
					break;
				case "RESET":
					payload = {"os-resetState": {"state": "active"}}
					break;
				case "SHUTOFF":
					payload = {"os-stop" : null}
					break;
			}
			
			let deferred = this.$q.defer()
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id + "/action"
			
			this.http.post(
				url,
				payload,
				{"headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then((response):void => {
				deferred.resolve(true)
			});
			return deferred.promise
		}
		
		serverAttachInterface(vm:VmItem, network:INetwork) {
			let deferred = this.$q.defer()
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/servers/" + vm.id + "/os-interface"
			
			let payload = { interfaceAttachment: { net_id: network.id } }
			
			this.http.post(
				url,
				payload,
				{"headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then((response):void => {
				let newInterface = response.interfaceAttachment
				newInterface.network = this._filter(this.networks, newInterface.net_id)
				
				this.ports.push(newInterface)
				vm.ports.push(newInterface)
				
				deferred.resolve(true)
			});
			return deferred.promise
		}
		
		
		addSubnet(network, subnetData) {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/subnets"
			
			this.http.post(
				url,
				{ subnet: subnetData },
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				if (!network.subnets.length) {
					network.subnets = []
				}
				if (!network.subnetCollection) {
					network.subnetCollection = []
				}
				network.subnets.push(response.subnet.id)
				network.subnetCollection.push(response.subnet)
				this.subnets.push(response.subnet)
				
				deferred.resolve(response.subnet)
			});
			
			return deferred.promise
		}
		
		loadNetworks():ng.IPromise< any > {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/networks"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				if (response.networks) {
					this.networks = response.networks
					this.loadSubnets().then(subnets => {
						subnets.forEach(subnet => {
							this.networks.forEach((network, index, arr) => {
								if (!network.subnetCollection) {
									network.subnetCollection = []
								}
								//console.log(subnet.id, network.subnets, network.subnets.indexOf(subnet.id))
								if (network.subnets.indexOf(subnet.id) > -1) {
									network.subnetCollection.push(subnet)
								}
							})
						})
					})
					deferred.resolve(response.networks)
				}
			})
			
			return deferred.promise
		}
		
		reloadNetwork(network_id) {
			
		}
		getNetwork(network_id: string)
		{
			let network: INetwork = null
			this.networks.forEach(item => {
				if (item.id == network_id)
					network = item
			})
			return network
		}
		
		createNetwork(data) {
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/networks"
			let deferred = this.$q.defer()
			
			let payload = { network: {
				name: data.name,
				admin_state_up: data.adminState,
				shared: data.isShared
			}}
			
			this.http.post(
				url,
				payload,
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				this.addNetwork(response.network)
				deferred.resolve(response.network)
			});
			
			return deferred.promise
		}
		
		/**
		 * Adds or updates floating ip
		 * @param fipData Floating ip JSON raw data
		 */
		addNetwork(networkData:INetwork) {
			let exists = false
			
			if (!networkData.subnetCollection) {
				networkData.subnetCollection = []
			}
			
			networkData.subnets.forEach(subnet_id => {
				console.log(subnet_id)
				networkData.subnetCollection.push(this.getSubnet(subnet_id))
				console.log(this.getSubnet(subnet_id))
			})
			
			console.log(networkData)
			// search if network exists in collection
			this.networks.forEach((network, index) => {
				if (networkData.id == network.id) {
					this.networks[index] = networkData
					exists = true
				}
			})
			console.log(exists, this.networks)
			if (!exists) {
				this.networks.push(networkData)
			}
		}
		
		/**
		 * Updates floating ip in API
		 * @param payload
		 */
		updateNetwork(network:INetwork, payload) {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/networks/" + network.id
			
			this.http.put(
				url,
				{network: payload},
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				if (response.network) {
					this.addNetwork(response.network)
				}
				deferred.resolve(response.network)
			});
			
			return deferred.promise
		}
		
		deleteNetwork(network:INetwork) {
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/networks/" + network.id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				this.removeNetwork(network.id)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		removeNetwork(network_id) {
			let deleteIndex = null
			this.networks.forEach((network, index) => {
				if (network.id == network_id) {
					deleteIndex = index
				}
			})
			if (deleteIndex != null) {
				this.networks.splice(deleteIndex, 1)
			}
		}
		
		loadSubnets():ng.IPromise< any > {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/subnets"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				if (response.subnets) {
					response.subnets.forEach(subnet => {
						this.subnets.push(subnet)
						deferred.resolve(response.subnets)
					})
				}
				console.log("SUBNETS", this.subnets)
			})
			
			return deferred.promise
		}
		
		/**
		 * Returns subnet based on ID
		 * @param subnet_id
		 * @returns {ISubnet}
		 */
		getSubnet(subnet_id: string)
		{
			let subnet: ISubnet = null
			this.subnets.forEach(item => {
				if (item.id == subnet_id)
					subnet = item
			})
			return subnet
		}
		
		/**
		 * Deletes subnet from API and cache
		 * @param subnet
		 * @returns {IPromise<T>}
		 */
		deleteSubnet(subnet:ISubnet) {
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/subnets/" + subnet.id
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				let index = this.subnets.indexOf(subnet)
				this.subnets.splice(index, 1)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		/**
		 * Loads/refreshes the list of floating ips
		 * @returns {IPromise<T>}
		 */
		loadFloatingIps():ng.IPromise< any > {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/floatingips"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				if (response.floatingips) {
					response.floatingips.forEach(fip => this.addFloatingIp(fip))
				}
			})
			return deferred.promise
		}
		
		/**
		 * Adds or updates floating ip
		 * @param fipData Floating ip JSON raw data
		 */
		addFloatingIp(fipData) {
			let fip = fipData
			if (fip.port_id != null) {
				fip.port = this._filter(this.ports, fip.port_id)
			}
			let exists = false
			// search if floating ip exists in collection
			this.project.floating_ips.forEach(floatingIp => {
				if (floatingIp.id == fip.id) {
					floatingIp = fip
					exists = true
				}
			})
			if (!exists) {
				this.project.floating_ips.push(fip)
			}
		}
		
		/**
		 * Updates floating ip in API
		 * @param payload
		 */
		updateFloatingIp(fipId, payload) {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/floatingips/" + fipId
			
			this.http.put(
				url,
				payload,
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				if (response.floatingip) {
					this.addFloatingIp(response.floatingip)
				}
				deferred.resolve(response.subnet)
			});
			
			return deferred.promise
		}
		
		reserveFloatingIp(network:INetwork) {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/floatingips"
			
			let payload = { floatingip: { floating_network_id: network.id } }
			
			this.http.post(
				url,
				payload,
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				if (response.floatingip) {
					this.addFloatingIp(response.floatingip)
				}
				deferred.resolve(response.subnet)
			});
			
			return deferred.promise
		}
		
		deleteFloatingIp(fip:IFloatingIp) {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/floatingips/" + fip.id
			
			this.http.delete(
				url,
				{ "headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id }}
			).then((response):void => {
				let index = this.project.floating_ips.indexOf(fip)
				this.project.floating_ips.splice(index, 1)
				deferred.resolve(true)
			});
			
			return deferred.promise
		}
		
		loadRouters():ng.IPromise< any > {
			let deferred = this.$q.defer();
			
			let endpoint = this.network_endpoint()
			let url:string = this.os_url + "/neutron/v2.0/routers"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then((response):void => {
				if (response.routers) {
					response.routers.forEach((router) => {
						if (router.external_gateway_info.network_id) {
							router.external_gateway_info.network = this.getNetwork(router.external_gateway_info.network_id)
						}
						if (router.external_gateway_info.external_fixed_ips.length) {
							router.external_gateway_info.external_fixed_ips.forEach((subnet) => {
								subnet.subnet = this.getSubnet(subnet.subnet_id)
							})
						}
					})
					this.routers = response.routers
					console.log("ROUTERS", this.routers)
				}
			})
			
			return deferred.promise
		}
		
		getVm(vmId:string):VmItem {
			let vm:VmItem
			this.listItems.forEach((item:VmItem) => {
				if (item.id == vmId) {
					vm = item
				}
			});
			return vm
		}
		
		updateVm(obj:VmItem) {
			this.listItems.forEach((vm:VmItem) => {
				if (vm.id == obj.id)
					vm = obj
			})
		}
		
		insertVm(vm:VmItem, keypair:IKeypair = null):ng.IPromise< boolean > {
			let index = this.listItems.length
			console.log("VM", vm)
			let vm_pos_y = index * 2 - 1
			let vm_pos_x = 15
			/*window['mapDetails']['elements']['vm' + '_' + vm.id] = {x: vm_pos_x, y: vm_pos_y, type: 'vm'}
			vm.network_interfaces.forEach((networkInterface:INetworkInterface) => {
				let newLink = {from: "network_" + networkInterface.network.name, to: 'vm' + '_' + vm.id, type: "uni", connector: "metro"}
				if (window['mapDetails']['links'].indexOf(newLink) == -1)
					window['mapDetails']['links'].push(newLink)
			})*/
			
			var networks = []
			angular.forEach(vm.networks, network => networks.push({uuid: network.id}))
			
			var payload = {
				server: {
					name: vm.name,
					imageRef: vm.image.id,
					flavorRef: vm.flavor.id,
					networks: networks
				}
			}
			
			if (keypair) {
				payload.server['keypair'] = keypair.name
			}
			
			console.log("Payload", payload)
			
			let deferred = this.$q.defer()
			let endpoint = this.compute_endpoint()
			console.log("ENDPOINT",endpoint)
			let url:string = this.os_url + "/nova/servers"
			
			this.http.post(
				url,
				payload,
				{"headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then((response):void => {
				console.log(response);
				if (!response.error) {
					this.listItems.push(vm);
				}
				deferred.resolve(true)
			});
			return deferred.promise
		}
		
		loadKeypairs():ng.IPromise< any > {
			let deferred = this.$q.defer()
			
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/os-keypairs"
			
			this.http.get(url, {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}).then(response => {
				if (response.keypairs) {
					response.keypairs.forEach(keypair => {
						this.addKeypair(keypair.keypair)
					}, this)
				}
				deferred.resolve(response.keypairs)
			})
			return deferred.promise;
		}
		
		addKeypair(keypair:IKeypair) {
			console.log(keypair)
			this.keypairs.push(keypair)
		}
		
		createKeypair(keypair:IKeypair) {
			let deferred = this.$q.defer()
			let endpoint = this.compute_endpoint()
			let url:string = this.os_url + "/nova/os-keypairs"
			
			let payload = { keypair: keypair}
			
			this.http.post(
				url,
				payload,
				{"headers": {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then((response):void => {
				this.addKeypair(response.keypair)
				deferred.resolve(response)
			});
			return deferred.promise
		}
		
		removeKeypair(keypair: IKeypair) {
			let index = this.keypairs.indexOf(keypair)
			this.keypairs.splice(index, 1)
		}
		
		deleteKeypair(keypair: IKeypair) {
			let endpoint = this.compute_endpoint()
			let url = this.os_url + "/nova/os-keypairs/" + keypair.name
			let deferred = this.$q.defer()
			
			this.http.delete(
				url,
				{headers: {"Endpoint-ID": endpoint.id, "Tenant-ID": this.identity.tenant_id}}
			).then(response => {
				this.removeKeypair(keypair)
				deferred.resolve(response)
			})
			return deferred.promise
		}
		
		/**
		 * Retrieves compute url
		 * @returns {any}
		 */
		private compute_endpoint():any
		{
			let endpoints = this.localStorage.get('endpoints')
			let url = endpoints.compute.publicURL
			let id = endpoints.compute.id
			
			if (!url) {
				console.log("Compute url not valid!", endpoints.compute.publicURL)
				return false
			}
			return {url: url, id: id}
		}
		
		/**
		 * Retrieves compute url
		 * @returns {any}
		 */
		private network_endpoint():any
		{
			let endpoints = this.localStorage.get('endpoints')
			let url = endpoints.network.publicURL
			let id = endpoints.network.id
			
			if (!url) {
				console.log("Compute url not valid!", endpoints.compute.publicURL)
				return false
			}
			return {url: url, id: id}
		}
		
		/**
		 * Retrieves compute url
		 * @returns {any}
		 */
		private images_endpoint():any
		{
			let endpoints = this.localStorage.get('endpoints')
			let url = endpoints.image.publicURL
			let id = endpoints.image.id
			
			//return "http://10.7.12.21:8774/v2/2e811ac45e548959bed63f7fbe32804"
			if (!url) {
				console.log("Compute url not valid!", endpoints.compute.publicURL)
				return false
			}
			return {url: url, id: id}
		}
		
		/**
		 * Retrieves compute url
		 * @returns {any}
		 */
		private cinder_endpoint():any
		{
			let endpoints = this.localStorage.get('endpoints')
			let url = endpoints.volume.publicURL
			let id = endpoints.volume.id
			
			//return "http://10.7.12.21:8774/v2/2e811ac45e548959bed63f7fbe32804"
			if (!url) {
				console.log("Compute url not valid!", endpoints.compute.publicURL)
				return false
			}
			return {url: url, id: id}
		}
		
		_filter(list:any[], id) {
			let el = null
			list.forEach(item => {
				if (item.id == id) {
					el = item
				}
			})
			return el
		}
	}
}

angular.module('auroraApp')
	.service('ComputeService', auroraApp.Services.ComputeService);