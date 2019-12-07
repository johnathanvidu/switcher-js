"use strict";

const config = require('./config');
const net = require('net');
const struct = require('python-struct');
const crc16ccitt = require('./crc').crc16ccitt;


const P_SESSION = "00000000"
const P_KEY = "00000000000000000000000000000000"


class Switcher {
    constructor() {

    }

    on() {
        var on_command = 1;
        this._run_power_command(on_command);
    }

    off() {
        var off_command = 0;
        this._run_power_command(off_command);
    }

    _login() {
        return new Promise(function (resolve, reject) {
            console.log('starting initialize sequence')
            var socket = net.connect(9957, config.switcher_ip);
            socket.on('ready', function() {
                var data = "fef052000232a100" + P_SESSION + "340001000000000000000000"  + this._get_time_stamp() + "00000000000000000000f0fe1c00" + config.phone_id + "0000" + config.device_pass + "00000000000000000000000000000000000000000000000000000000";
                data = this._crc_sign_full_packet_com_key(data, P_KEY);
                console.log("[*] Sending Login Packet to Switcher...");
                socket.write(Buffer.from(data, 'hex'));
                socket.once('data', function(data) {
                    var result_session = data.toString('hex').substr(16, 8)  
                    // todo: make sure result_session exists
                    console.log('recieved session id: ' + result_session)
                    socket.end();
                    resolve(result_session); // returning _p_session after a successful login 
                }.bind(this));
            }.bind(this));
            socket.on('close', function(had_error) {
                
            });
        }.bind(this));
    }

    _run_power_command(type) {
        this._login().then(function(p_session) {
            var socket = net.connect(9957, config.switcher_ip);
            socket.on('ready', function() {
                var data = "fef05d0002320102" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + config.device_id + "00" + config.phone_id + "0000" + config.device_pass + "000000000000000000000000000000000000000000000000000000000106000" + type + "0000000000"
                data = this._crc_sign_full_packet_com_key(data, P_KEY);
                console.log('sending on command');
                socket.write(Buffer.from(data, 'hex'));
                socket.once('data', function(data) {
                    console.log('done');
                    socket.end();
                }.bind(this));
            }.bind(this));
            socket.on('close', function(hadError) {
                if (hadError == true) {
                    console.log('had error, closed')        
                } else {
                    console.log('closed') 
                }
            }.bind(this));
        }.bind(this));
    }
    
    _state(socket, p_session) {
        var data = "fef0300002320103" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + config.device_id + "00"
        data = this._crc_sign_full_packet_com_key(data, pKey);
        socket.write(Buffer.from(data, 'hex'), function(err) {
                console.log('data was written')
        })
        socket.once('data', function(data) {
            var device_name = data.toString().substr(40, 32) 
            var state = data.toString('hex').substr(150, 4) 
            console.log('device name ' + device_name)
            if (state == '0000') {
                console.log('state off')
            } else {
                console.log('state on')
            }
        })
    }

    _get_time_stamp() {
        var time_in_seconds = Math.round(new Date().getTime() / 1000);
        return struct.pack('<I', parseInt(time_in_seconds)).toString('hex');
    }

    _crc_sign_full_packet_com_key(p_data, p_key) {
        var crc = struct.pack('>I', crc16ccitt(Buffer.from(p_data, 'hex'), 0x1021)).toString('hex');
        p_data = p_data + crc.substr(6, 2) + crc.substr(4, 2);
        crc = crc.substr(6, 2) + crc.substr(4, 2) + Buffer.from(p_key).toString('hex');
        crc = struct.pack('>I', crc16ccitt(Buffer.from(crc, 'hex'), 0x1021)).toString('hex');
        p_data = p_data + crc.substr(6, 2) + crc.substr(4, 2);
        return p_data
    }
}

//var val = new Switcher()._crc_sign_full_packet_com_key("fef052000232a1000000000034000100000000000000000018f7ea5d00000000000000000000f0fe1c00000000000000000000000000000000000000000000000000000000000000000000000000", '00000000000000000000000000000000')
var switcher = new Switcher();
switcher.on()
// setTimeout(function() {
//     switcher.off();
// }, 10000)

module.exports = Switcher