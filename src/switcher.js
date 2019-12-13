"use strict";

const config = require('./config');
const net = require('net');
const util = require('util');
const struct = require('python-struct');
const crc16ccitt = require('./crc').crc16ccitt;


const P_SESSION = "00000000"
const P_KEY = "00000000000000000000000000000000"


class Switcher {
    constructor(config, log) {
        this.switcher_ip = config['switcher_ip'];
        this.config = config;
        this.log = log;
        this.p_session = null;
    }

    discover() { // static and will return a new Switcher class

    }

    on() {
        var on_command = 1;
        this._run_power_command(on_command);
    }

    off() {
        var off_command = 0;
        this._run_power_command(off_command);
    }

    async on_with(duration) {
        var on_command = 1;
        var p_session = await this._login(); 
        var socket = await this._connect(9957, this.switcher_ip);
        var data = "fef05d0002320102" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + config.device_id + "00" + config.phone_id + "0000" + config.device_pass + "000000000000000000000000000000000000000000000000000000000106000" + on_command + "00"  + this._timer_value(duration);
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            this.log("turned on for ", duration);
            socket.end();
        });
    }

    async status(callback) {
        var p_session = await this._login(); 
        var socket = await this._connect(9957, this.switcher_ip);
        var data = "fef0300002320103" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + config.device_id + "00"
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            var device_name = data.toString().substr(40, 32);
            var state_hex = data.toString('hex').substr(150, 4); 

            var b = data.toString('hex').substr(178, 8); 
            var open_time = parseInt(b.substr(6, 2) + b.substr(4, 2) + b.substr(2, 2) + b.substr(0, 2), 16);
            var remaining_seconds = open_time;
            this.log('remaining seconds', remaining_seconds);
            var state = state_hex == '0000' ? 0 : 1; 
            callback({
                name: device_name,
                state: state,
                remaining_seconds: remaining_seconds,
            })
            socket.end();
        });
        socket.on('close', (had_error) => {
            
        });
    }

    async _login(cache = true) {
        if (cache && this.p_session) return this.p_session;
        this.p_session = await new Promise(async (resolve, reject) => {
            this.log('starting initialize sequence')
            var socket = await this._connect(9957, this.switcher_ip)
            var data = "fef052000232a100" + P_SESSION + "340001000000000000000000"  + this._get_time_stamp() + "00000000000000000000f0fe1c00" + config.phone_id + "0000" + config.device_pass + "00000000000000000000000000000000000000000000000000000000";
            data = this._crc_sign_full_packet_com_key(data, P_KEY);
            this.log("[*] Sending Login Packet to Switcher...");
            socket.write(Buffer.from(data, 'hex'));
            socket.once('data', (data) => {
                var result_session = data.toString('hex').substr(16, 8)  
                // todo: make sure result_session exists
                this.log('recieved session id: ' + result_session)
                resolve(result_session); // returning _p_session after a successful login 
                socket.end();
            });
        });
        return this.p_session;
    }

    async _run_power_command(type) {
        var p_session = await this._login(); 
        var socket = await this._connect(9957, this.switcher_ip);
        var data = "fef05d0002320102" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + config.device_id + "00" + config.phone_id + "0000" + config.device_pass + "000000000000000000000000000000000000000000000000000000000106000" + type + "0000000000"
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        this.log('sending on command');
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            this.log('done');
            socket.end();
        });

        socket.on('close', (hadError) => {
            if (hadError == true) {
                this.log('had error, closed')        
            } else {
                this.log('close') 
            }
        });
    }

    _connect(port, ip) {
        return new Promise((resolve, reject) => {
            var socket = net.connect(port, ip);
            socket.once('ready', () => {
                resolve(socket);
            });
            socket.once('close', (had_error) => {
                reject(had_error);
            });
            socket.once('error', (err) => {
                reject(err);
            });
        });
    }

    _get_time_stamp() {
        var time_in_seconds = Math.round(new Date().getTime() / 1000);
        return struct.pack('<I', parseInt(time_in_seconds)).toString('hex');
    }

    _timer_value(minutes) {
        var seconds = parseInt(minutes) * 60;
        return struct.pack('<I', seconds).toString('hex');
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

module.exports = {
    Switcher: Switcher
}