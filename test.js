const Switcher = require('./src/switcher').Switcher;


var switcher = new Switcher('53fd5e', '192.168.1.108','0000', '00000000', console);

switcher.turn_off();
switcher.on('state', (state) => {
    switcher.close();
});
