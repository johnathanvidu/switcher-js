# switcher-js2

*Fork of [@johnathanvidu JS implementation](https://github.com/johnathanvidu/switcher-js)*

switcher-js is a native nodejs library for controling [Switcher](https://switcher.co.il/)  smart home accessories - water heater, sockets, and blinds.<br/><br/>
It is a native javascript port of a wonderful python script (can be found [here](https://github.com/NightRang3r/Switcher-V2-Python)) created as a result of the extensive work which has been done by Aviad Golan ([@AviadGolan](https://twitter.com/AviadGolan)) and Shai rod ([@NightRang3r](https://twitter.com/NightRang3r)).<br/>
It is a work in progress and there is still a lot of work left to do.

I built it according to my specific needs and my specific device. If any issue arises, please feel free to open an issue and I'll do my best to help.<br/>
Current supported devices known to work with switcher-js:<br/>
- **Switcher Runner Mini**
- **Switcher Runner**
- **Switcher V4**
- **Switcher Mini**
- **Switcher V3**: (Switcher touch) - Firmware **V1.51**
- **Switcher V2**: Firmware **3.21** (Based on ESP chipset) 
- **Switcher V2**: Firmware**72.32** (Qualcomm chipset)
- 

## Installation
Use [npm](https://www.npmjs.com/) to install switcher-js.
```bash
npm install switcher-js2
```

## Usage Examples:
```javascript
const Switcher = require('switcher-js2');

var switcher = new Switcher('device-id', 'device-ip', 'log function', 'listen(boolean)', 'device-type');
```

### Discover

To use the auto discover functionallity use: 
```javascript
const Switcher = require('switcher-js2');

var proxy = Switcher.discover('log function', 'identifier(optional)', 'discovery-timeout(optional)');

proxy.on('ready', (switcher) => {
    switcher.turn_on(); // switcher is a new initialized instance of Switcher class
});


setTimeout(() => {
    proxy.close(); // optional way to close the discovery (if discovery-timeout is not set)
}, 10000);

```

discover will emit a ready event when auto discovery completed.

identifier (optional) - you can provide the Switcher name, IP or device-id to detect specific device.<br/>
discovery-timeout (optional) - set maximum time in seconds to scan for devices.


### Control

```javascript
const Switcher = require('switcher-js2');

var switcher = new Switcher('device-id', 'device-ip', 'log function', 'listen', 'device-type'); 
// set listen to true if you want to listen for status messages

switcher.on('status', (status) => { // status broadcast message - only works when listen=true
    console.log(status)
    /* response:
    {
        power: 1,
        remaining_seconds: 591,
        default_shutdown_seconds: 5400,
        power_consumption: 2447 // in watts
    }
    */
});
switcher.on('state', (state) => { // state is the new switcher state
    console.log(state) // 1
});
switcher.on('error', (error) => {

});

switcher.turn_on();   // turns switcher on
switcher.turn_on(15); // turns switcher on for 15 minutes
switcher.turn_off();  // turns switcher off
switcher.set_default_shutdown(3600) // set the default auto shutdown to 1 hour (must be between 3600 and 86340)
switcher.status(status => { // get status
    console.log(status);
});
switcher.close();     // closes any dangling connections safely
```

### Control Runner Devices (blinds)

```javascript
const Switcher = require('switcher-js2');

var runner = new Switcher('device-id', 'device-ip', 'log function', 'listen', 'runner'); 
// set 'device-type' to 'runner' if you want to control the runner devices

runner.on('status', (status) => { // status broadcast message - only works when listen=true
    console.log(status)
    /* response:
    {
        position: 80,
        direction: 'STOP'
    }
    */
});
runner.on('position', (pos) => { // position is the new switcher position
    console.log(pos) // 100
});
switcher.on('error', (error) => {

});

switcher.set_position(80);   // Set blinds position to 80%

switcher.stop_runner() // stop the blinds

switcher.close();     // closes any dangling connections safely
```

### Listen

Global listen functionality that listens to a single or multiple switcher devices for status messages.

To use the listen functionallity use: 
```javascript
const Switcher = require('switcher-js2');

var proxy = Switcher.listen('log function', 'identifier(optional)');

proxy.on('message', (message) => {
    console.log(message)
    /* response:
    {
        device_id: 'e3a845',
        device_ip: '10.0.0.1',
        name: 'Boiler',
        type: 'v4'
        state: {
            power: 1,
            remaining_seconds: 591,
            default_shutdown_seconds: 5400,
            power_consumption: 2447 // in watts
        }
    }
    */
});

proxy.close(); // close the listener socket

```

proxy will emit a message event every time it receives a message from a switcher device.

identifier (optional) - you can provide the Switcher name, IP or device-id to filter specific device messages.

## Multiple Connections

Don't use Discover, Listen and Switcher with (listen=true) at the same time as it will return error since this socket is being used.
If you want to listen to multiple devices, use the global listen function to get all statuses, and use the switcher instance without the listen capability.

## Contributing
Pull requests are more than welcome. For major changes, please open an issue first to discuss what you would like to change.
Even coding tips and standards are welcome, I have very limited experience with javascript, so there's a lot of things I don't know are cleaner or more standarized in the industry.

## License
[MIT](https://choosealicense.com/licenses/mit/)