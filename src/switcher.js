"use strict";

const net = require('net');
const dgram = require('dgram');
const struct = require('python-struct');
const EventEmitter = require('events').EventEmitter;

const crc16ccitt = require('./crc').crc16ccitt;
const SwitcherUDPMessage = require('./udp')

const P_SESSION = '00000000';
const P_KEY = '00000000000000000000000000000000';

const STATUS_EVENT = 'status';
const MESSAGE_EVENT = 'message'
const READY_EVENT = 'ready';
const ERROR_EVENT = 'error';
const STATE_CHANGED_EVENT = 'state';
const DURATION_CHANGED_EVENT = 'duration';
const POSITION_CHANGED_EVENT = 'position';


const SWITCHER_UDP_IP = "0.0.0.0";
const SWITCHER_UDP_PORT = 20002;
const SWITCHER_UDP_PORT2 = 20003;

const SWITCHER_TCP_PORT = 9957;
const SWITCHER_TCP_PORT2 = 10000;
const NEW_TCP_GROUP = ['runner', 'runner_mini'];

const OFF = 0;
const ON = 1;



class ConnectionError extends Error {
    constructor(ip, port) {
        super(`connection error: failed to connect to switcher on ip: ${ip}:${port}. please make sure it is turned on and available.`);
        this.ip = ip;
        this.port = port;
    }
}


class Switcher extends EventEmitter { 
    constructor(device_id, switcher_ip, log, listen, device_type) {
        super();
        this.device_id = device_id;
        this.switcher_ip = switcher_ip;
        this.device_type = device_type || 'unknown';
        this.phone_id = '0000';
        this.device_pass = '00000000';
        this.newType = NEW_TCP_GROUP.includes(device_type)
        this.SWITCHER_PORT = newType ? SWITCHER_TCP_PORT2 : SWITCHER_TCP_PORT;
        this.log = log;
        this.p_session = null;
        this.socket = null;
        if (listen)
            this.status_socket = this._hijack_status_report();
    }

    static discover(log, identifier, discovery_timeout) {
        var proxy = new EventEmitter.EventEmitter();
        var timeout = null
        var socket = dgram.createSocket('udp4', (raw_msg, rinfo) => {
            var ipaddr = rinfo.address;
            if (!SwitcherUDPMessage.is_valid(raw_msg)) {
                return; // ignoring - not a switcher broadcast message
            }
            var udp_message = new SwitcherUDPMessage(raw_msg);
            var device_id = udp_message.extract_device_id();
            var device_name = udp_message.extract_device_name();
            var device_type = udp_message.extract_type();
            if (identifier && identifier !== device_id && identifier !== device_name && identifier !== ipaddr) {
                log(`Found ${device_name} (${ipaddr}) - Not the device we\'re looking for!`);
                return;
            }

            // log(`Found ${device_name} (${ipaddr})!`);
            proxy.emit(READY_EVENT, new Switcher(device_id, ipaddr, log, false, device_type));
            clearTimeout(timeout);
            socket.close();
            socket = null;
            
        });
        socket.on('error', (error) => {
            proxy.emit(ERROR_EVENT, error);
            clearTimeout(timeout);
            socket.close();
            socket = null;
        });
        socket.bind(SWITCHER_UDP_PORT, SWITCHER_UDP_IP);

        var socket2 = dgram.createSocket('udp4', (raw_msg, rinfo) => {
            var ipaddr = rinfo.address;
            if (!SwitcherUDPMessage.is_valid(raw_msg)) {
                return; // ignoring - not a switcher broadcast message
            }
            var udp_message = new SwitcherUDPMessage(raw_msg);
            var device_id = udp_message.extract_device_id();
            var device_name = udp_message.extract_device_name();
            var device_type = udp_message.extract_type();
            if (identifier && identifier !== device_id && identifier !== device_name && identifier !== ipaddr) {
                log(`Found ${device_name} (${ipaddr}) - Not the device we\'re looking for!`);
                return;
            }

            // log(`Found ${device_name} (${ipaddr})!`);
            proxy.emit(READY_EVENT, new Switcher(device_id, ipaddr, log, false, device_type));
            clearTimeout(timeout);
            socket2.close();
            socket2 = null;
            
        });
        socket2.on('error', (error) => {
            proxy.emit(ERROR_EVENT, error);
            clearTimeout(timeout);
            socket2.close();
            socket2 = null;
        });
        socket2.bind(SWITCHER_UDP_PORT2, SWITCHER_UDP_IP);

        if (discovery_timeout);
            timeout = setTimeout(() => {
                log(`stopping discovery, closing socket`);
                socket.close();
                socket = null;
                socket2.close();
                socket2 = null;
            }, discovery_timeout*1000);

        proxy.close = () => {
            log('closing discover socket');
            if (socket) {
                socket.close();
                log('discovery socket is closed');
            }
            if (socket2) {
                socket2.close();
                log('discovery socket2 is closed');
            }
        }
        return proxy;
    }

    static listen(log, identifier) {
        var proxy = new EventEmitter.EventEmitter();
        var socket = dgram.createSocket('udp4', (raw_msg, rinfo) => {
            var ipaddr = rinfo.address;
            if (!SwitcherUDPMessage.is_valid(raw_msg)) {
                return; // ignoring - not a switcher broadcast message
            }
            var udp_message = new SwitcherUDPMessage(raw_msg);
            var device_id = udp_message.extract_device_id();
            var device_name = udp_message.extract_device_name();
            if (identifier && identifier !== device_id && identifier !== device_name && identifier !== ipaddr) {
                log(`Found ${device_name} (${ipaddr}) - Not the device we\'re looking for!`);
                return;
            }

            // log(`Found ${device_name} (${ipaddr})!`);
            proxy.emit(MESSAGE_EVENT, {
                device_id: device_id,
                device_ip: ipaddr,
                name: device_name,
                type: udp_message.extract_type(),
                state: {
                    power: udp_message.extract_switch_state(),
                    remaining_seconds: udp_message.extract_shutdown_remaining_seconds(),
                    default_shutdown_seconds: udp_message.extract_default_shutdown_seconds(),
                    power_consumption: udp_message.extract_power_consumption()
                }
            });
            
        });
        socket.on('error', (error) => {
            proxy.emit(ERROR_EVENT, error);
            socket.close();
            socket = null;
        });
        socket.bind(SWITCHER_UDP_PORT, SWITCHER_UDP_IP);
        
        var socket2 = dgram.createSocket('udp4', (raw_msg, rinfo) => {
            var ipaddr = rinfo.address;
            if (!SwitcherUDPMessage.is_valid(raw_msg)) {
                return; // ignoring - not a switcher broadcast message
            }
            var udp_message = new SwitcherUDPMessage(raw_msg);
            var device_id = udp_message.extract_device_id();
            var device_name = udp_message.extract_device_name();
            if (identifier && identifier !== device_id && identifier !== device_name && identifier !== ipaddr) {
                log(`Found ${device_name} (${ipaddr}) - Not the device we\'re looking for!`);
                return;
            }

            // log(`Found ${device_name} (${ipaddr})!`);
            proxy.emit(MESSAGE_EVENT, {
                device_id: device_id,
                device_ip: ipaddr,
                name: device_name,
                type: udp_message.extract_type(),
                state: {
                    position: udp_message.extract_position(),
                    direction: udp_message.extract_direction()
                }
            });
            
        });
        socket2.on('error', (error) => {
            proxy.emit(ERROR_EVENT, error);
            socket2.close();
            socket2 = null;
        });
        socket2.bind(SWITCHER_UDP_PORT2, SWITCHER_UDP_IP);

        proxy.close = () => {
            log('closing listener socket');
            if (socket) {
                socket.close();
                log('listener socket is closed');
            }
            if (socket2) {
                socket2.close();
                log('listener socket2 is closed');
            }
        }
        return proxy;
    }

    turn_off() {
        var off_command = OFF + '00' + '00000000';
        this._run_power_command(off_command);
    }

    turn_on(duration=0) {
        var on_command = ON +'00' + this._timer_value(duration);
        this._run_power_command(on_command);
    }

    set_position(pos=0) {
        var position_command = this._get_hex_pos(pos)
        this._run_position_command(position_command);
    }

    async set_default_shutdown(duration=3600) {
        var auto_close = this._set_default_shutdown(duration)
        var p_session = await this._login(); 
        var data = "fef05b0002320102" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + this.device_id +
                   "00" + this.phone_id + "0000" + this.device_pass + "00000000000000000000000000000000000000000000000000000000040400" + auto_close;
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        this.log(`sending default_shutdown command | ${duration} seconds`);
        var socket = await this._getsocket();
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            this.emit(DURATION_CHANGED_EVENT, duration); // todo: add old state and new state
        });

    }

    async status(callback) {  // refactor
        var p_session = await this._login(); 
        var data = "fef0300002320103" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + this.device_id + "00";
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        var socket = await this._getsocket();
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            var device_name = data.toString().substr(40, 32).replace(/\0/g, '');;
            var state_hex = data.toString('hex').substr(150, 4);
            var state = state_hex == '0000' ? OFF : ON; 
            var b = data.toString('hex').substr(178, 8); 
            var remaining_seconds = parseInt(b.substr(6, 2) + b.substr(4, 2) + b.substr(2, 2) + b.substr(0, 2), 16);
            b = data.toString('hex').substr(194, 8);
            var default_shutdown_seconds = parseInt(b.substr(6, 2) + b.substr(4, 2) + b.substr(2, 2) + b.substr(0, 2), 16);
            b = data.toString('hex').substr(154, 4); 
            var power_consumption = parseInt(b.substr(2, 2) + b.substr(0, 2), 16);
            callback({
                device_id: this.device_id,
                power: state,
                remaining_seconds: remaining_seconds,
                default_shutdown_seconds: default_shutdown_seconds,
                power_consumption: power_consumption
            });
        });
    }

    close() {
        if (this.socket && !this.socket.destroyed) {
            this.log('closing sockets');
            this.socket.destroy();
            this.log('main socket is closed');
        }
        if (this.status_socket && !this.status_socket.destroyed) {
            this.log('closing sockets');
            this.status_socket.close();
            this.log('status socket is closed');
        }
    }

    async _getsocket() {
        if (this.socket && !this.socket.destroyed) {
            return await this.socket;
        }
        try {
            var socket = await this._connect(this.SWITCHER_PORT, this.switcher_ip);
            socket.on('error', (error) => {
                this.log('gloabal error event:', error);
            });
            socket.on('close', (had_error) => {
                this.log('gloabal close event:', had_error);
            });
            this.socket = socket;
            return socket;
        }
        catch(error) {
            this.socket = null;
            this.emit(ERROR_EVENT, new ConnectionError(this.switcher_ip, this.SWITCHER_PORT));
            throw error;
        }
    }

    _connect(port, ip) {
        return new Promise((resolve, reject) => {
            var socket = net.connect(port, ip);
            socket.setKeepAlive(true);
            socket.once('ready', () => {
                this.log('successful connection, socket was created');
                resolve(socket);
            });
            socket.once('close', (had_error) => {
                this.log('connection closed, had error:', had_error)
                reject(had_error);
            });
            socket.once('error', (error) => {
                this.log('connection rejected, error:', error)
                reject(error);
            });
        });
    }

    _hijack_status_report() {
        var socket = dgram.createSocket('udp4', (raw_msg, rinfo) => {
            if (!SwitcherUDPMessage.is_valid(raw_msg)) {
                return; // ignoring - not a switcher broadcast message
            }
            var ipaddr = rinfo.address;
            var udp_message = new SwitcherUDPMessage(raw_msg);

            var device_id = udp_message.extract_device_id()
            if (device_id === this.device_id) {
                if (!this.newType)
                    this.emit(STATUS_EVENT, {
                        power: udp_message.extract_switch_state(),
                        remaining_seconds: udp_message.extract_shutdown_remaining_seconds(),
                        default_shutdown_seconds: udp_message.extract_default_shutdown_seconds(),
                        power_consumption: udp_message.extract_power_consumption()
                    })
                else
                    this.emit(STATUS_EVENT, {
                        position: udp_message.extract_position(),
                        direction: udp_message.extract_direction()
                    })
            }
        });
        socket.on('error', (error) => {
            this.emit(ERROR_EVENT, new Error("status report failed. error: " + error.message)); // hoping this will keep the original stack trace
        });
        socket.bind(!this.newType ? SWITCHER_UDP_PORT : SWITCHER_UDP_PORT2, SWITCHER_UDP_IP);
        return socket;
    }

    async _login() {
        if (this.p_session) return this.p_session;
        try {
            this.p_session = await new Promise(async (resolve, reject) => {
                var data = "fef052000232a100" + P_SESSION + "340001000000000000000000"  + this._get_time_stamp() + "00000000000000000000f0fe1c00" + 
                           this.phone_id + "0000" + this.device_pass + "00000000000000000000000000000000000000000000000000000000";
                data = this._crc_sign_full_packet_com_key(data, P_KEY);
                this.log("login...");
                try {
                    var socket = await this._getsocket();
                } catch (err) {
                    reject(err)
                    return
                }
                socket.write(Buffer.from(data, 'hex'));
                socket.once('data', (data) => {
                    var result_session = data.toString('hex').substr(16, 8)  
                    // todo: make sure result_session exists
                    this.log('received session id: ' + result_session);
                    resolve(result_session); // returning _p_session after a successful login 
                });
                this.socket.once('error', (error) => {
                    reject(error);
                });
            });
        }
        catch (error) {
            this.log('login failed due to an error', error);
            this.emit(ERROR_EVENT, new Error(`login failed due to an error: ${error.message}`));
        }
        return this.p_session;
    }
    
    async _login2() {
        if (this.p_session) return this.p_session;
        try {
            this.p_session = await new Promise(async (resolve, reject) => {
                var data = "fef030000305a600" + P_SESSION + "ff0301000000" + this.phone_id + "00000000" + this._get_time_stamp() + "00000000000000000000f0fe" + 
                        this.device_id + "00";
                data = this._crc_sign_full_packet_com_key(data, P_KEY);
                this.log("login...");
                try {
                    var socket = await this._getsocket();
                } catch (err) {
                    reject(err)
                    return
                }
                // this.log('sending data')
                // this.log(data)
                socket.write(Buffer.from(data, 'hex'));
                socket.once('data', (data) => {
                    var result_session = data.toString('hex').substr(16, 8)  
                    // this.log('received login data:')
                    // this.log(data.toString('hex'))
                    // todo: make sure result_session exists
                    this.log('received session id: ' + result_session);
                    resolve(result_session); // returning _p_session after a successful login 
                });
                this.socket.once('error', (error) => {
                    reject(error);
                });
            });
        }
        catch (error) {
            this.log('login failed due to an error', error);
            this.emit(ERROR_EVENT, new Error(`login failed due to an error: ${error.message}`));
        }
        return this.p_session;
    }

    async _run_power_command(command_type) {
        var p_session = await this._login(); 
        var data = "fef05d0002320102" + p_session + "340001000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + this.device_id +
                   "00" + this.phone_id + "0000" + this.device_pass + "000000000000000000000000000000000000000000000000000000000106000" + command_type;
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        this.log('sending ' + Object.keys({OFF, ON})[command_type.substr(0, 1)] +  ' command');
        var socket = await this._getsocket();
        try {
            var socket = await this._getsocket();
        } catch (err) {
            this.log(err)
            return
        }
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            this.emit(STATE_CHANGED_EVENT, command_type.substr(0, 1));
        });
    }

    async _run_position_command(position_command) {
        const pos = parseInt(position_command, 16)
        var p_session = await this._login2(); 
        var data = "fef0580003050102" + p_session + "290401" + "000000000000000000" + this._get_time_stamp() + "00000000000000000000f0fe" + this.device_id +
                   "00" + this.phone_id + "0000" + this.device_pass + "000000000000000000000000000000000000000000000000000000" + "37010100" + position_command;
        data = this._crc_sign_full_packet_com_key(data, P_KEY);
        this.log(`sending position command | ${pos}%`);
        var socket = await this._getsocket();
        // this.log('sending data:')
        // this.log(data)
        socket.write(Buffer.from(data, 'hex'));
        socket.once('data', (data) => {
            // this.log('data received:')
            // this.log(data.toString('hex'))
            this.emit(POSITION_CHANGED_EVENT, pos); // todo: add old state and new state
        });
    }

    _get_time_stamp() {
        var time_in_seconds = Math.round(new Date().getTime() / 1000);
        return struct.pack('<I', parseInt(time_in_seconds)).toString('hex');
    }

    _timer_value(minutes) {
        if (minutes == 0) return "00000000";  // when duration set to zero, Switcher sends regular on command
        var seconds = parseInt(minutes) * 60;
        return struct.pack('<I', seconds).toString('hex');
    }

    _set_default_shutdown(seconds) {
        if (seconds < 3600) {
            this.log('Value Can\'t be less than 1 hour!, setting to 3600')
            seconds = 3600
        } else if (seconds > 86340) {
            this.log('Value can\'t be more than 23 hours and 59 minutes, setting to 86340')
            seconds = 86340
        } else return struct.pack('<I', seconds).toString('hex');
    }
    
    _get_hex_pos(pos=0) {
        var hex = Number(pos).toString(16);
        if (hex.length < 2) {
            hex = "0" + hex;
        }
        return hex
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
    Switcher: Switcher,
    ConnectionError: ConnectionError
}