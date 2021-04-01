"use strict";


const direction_commands = {
    '0000': 'STOP',
    '0100': 'UP',
    '0001': 'DOWN'
}

const types = {
    'a8': 'power_plug',
    'a1': 'v2_qca',
    'a7': 'v2_esp',
    '0b': 'v3',
    '17': 'v4',
    '0f': 'mini',
    '01': 'runner',
    '02': 'runner_mini'
}

class SwitcherUDPMessage {
    constructor(message_buffer) {
        this.data_str = message_buffer.toString();
        this.data_hex = message_buffer.toString('hex');
    }

    static is_valid(message_buffer) {
        return (Buffer.isBuffer(message_buffer) && message_buffer.toString('hex').substr(0, 4) === 'fef0' && 
            (Buffer.byteLength(message_buffer) === 165 || Buffer.byteLength(message_buffer) === 159));
    }

    extract_type() {
        var type_hex = this.data_hex.substr(150, 2); 
        return types[type_hex] || `unknown_${type_hex}`;
    }

    extract_ip_addr() {
        var ip_addr_section = this.data_hex.substr(152, 8);
        var ip_addr_int = parseInt(
            ip_addr_section.substr(0, 2) + 
            ip_addr_section.substr(2, 2) +
            ip_addr_section.substr(4, 2) +
            ip_addr_section.substr(6, 2), 16);
        return this.inet_ntoa(ip_addr_int);
    }

    extract_device_name() {
        return this.data_str.substr(40, 32).replace(/\0/g, ''); // remove leftovers after the name
    }

    extract_device_id() {
        return this.data_hex.substr(36, 6);
    }

    extract_switch_state() {
        return this.data_hex.substr(266, 4) == '0000' ? 0 : 1;
    }

    extract_shutdown_remaining_seconds() {
        var time_left_section = this.data_hex.substr(294, 8); 
        return parseInt(
            time_left_section.substr(6, 2) + 
            time_left_section.substr(4, 2) + 
            time_left_section.substr(2, 2) + 
            time_left_section.substr(0, 2), 16);
    }

    extract_default_shutdown_seconds() {
        var shutdown_settings_section = this.data_hex.substr(310, 8); 
        return parseInt(
            shutdown_settings_section.substr(6, 2) + 
            shutdown_settings_section.substr(4, 2) + 
            shutdown_settings_section.substr(2, 2) + 
            shutdown_settings_section.substr(0, 2), 16);
    }
    
    extract_power_consumption() {
        var power_consumption_section = this.data_hex.substr(270, 4); 
        return parseInt(
            power_consumption_section.substr(2, 2) + 
            power_consumption_section.substr(0, 2), 16);
    }

    inet_ntoa(num) { // extract to utils https://stackoverflow.com/a/21613691
        var a = ((num >> 24) & 0xFF) >>> 0;
        var b = ((num >> 16) & 0xFF) >>> 0;
        var c = ((num >> 8) & 0xFF) >>> 0;
        var d = (num & 0xFF) >>> 0;
        return(a + "." + b + "." + c + "." + d);
    }
    
    extract_direction() {
        var direction = this.data_hex.substr(274, 4); 
        return direction_commands[direction];
    }
    
    extract_position() {
        var position_section = this.data_hex.substr(270, 4); 
        return parseInt(
            position_section.substr(2, 2) + 
            position_section.substr(0, 2), 16);
    }
} 



module.exports = SwitcherUDPMessage