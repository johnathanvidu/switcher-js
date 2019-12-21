# switcher-js
switcher-js is a native nodejs library for controling [switcher smart water heater](https://switcher.co.il/).<br/>
It is a native javascript port of a wonderful python script (can be found [here](https://github.com/NightRang3r/Switcher-V2-Python)) created as a result of the extensive work which has been done by Aviad Golan ([@AviadGolan](https://twitter.com/AviadGolan)) and Shai rod ([@NightRang3r](https://twitter.com/NightRang3r)).<br/>
It is a work in progress and there is still a lot of work left to do.

I built it according to my specific needs and my specific device. If any issue arises, please feel free to open an issue and I'll do my best to help.<br/>
Current supported devices known to work with switcher-js:><br/>
Switcher V3 (Switcher touch) - FW V1.51

## Installation
Use [npm](https://www.npmjs.com/) to install switcher-js.
```bash
npm install switcher-js
```

## Usage
```javascript
const Switcher = require('switcher-js').Switcher;

var switcher = new Switcher('device-id', 'device-ip', 'phone-id', 'device-pass', 'log function');
```

To use the auto discover functionallity use: 
```javascript
const Switcher = require('switcher-js').Switcher;

var proxy = Switcher.discover('phone-id', 'device-pass', 'log function');

proxy.on('ready', (switcher) => {
    switcher.turn_on(); // switcher is a new initialized instance of Switcher class
});
```

discover will emit a ready event when auto discovery completed.

phone-id (optional) - will be defaulted to 0000 if no value provided<br/>
device-pass (optional) - will be defaulted to 00000000 if no value provided

Examples:
```javascript
const Switcher = require('switcher-js').Switcher;

var switcher = new Switcher('device-id', 'device-ip', 'phone-id', 'device-pass', 'log function');

switcher.on('state', (state) => { // state is the new switcher state 
    
});
switcher.on('error', (error) => {

});

switcher.turn_on();   // turns switcher on
switcher.turn_on(15); // turns switcher on for 15 minutes
switcher.turn_off();  // turns switcher off
switcher.close();     // closes any dangling connections safely
```

switcher-js exposes two states for convenience 

```javascript
const switcher = require('switcher-js');

switcher.ON = 0
switcher.OFF = 1
```

## Contributing
Pull requests are more than welcome. For major changes, please open an issue first to discuss what you would like to change.
Even coding tips and standards are welcome, I have very limited experience with javascript, so there's a lot of things I don't know are cleaner or more standarized in the industry.

## License
[MIT](https://choosealicense.com/licenses/mit/)