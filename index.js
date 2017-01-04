// homebridge-simplex plugin for Raspberry Pi
// Version: 0.9.0
// Release date: 20161230
//
// Copyright (c) 2016 by simplexjunkie (simplexjunkie@gmail.com)

// I'm not a programmer, so if you don't like my code feel free to improve it.
// Don't contact me for support on it. All nessesary information is on the internet.


var rpio = require('rpio');
var Service, Characteristic;

module.exports = function(homebridge)
{
    Service          = homebridge.hap.Service;
    Characteristic   = homebridge.hap.Characteristic;
     
    homebridge.registerAccessory('homebridge-simplex', 'SimplexLock', SimplexLockAccessory);
}

function SimplexLockAccessory(log, config)
{
    this.log               = log;
    this.name              = config['name'];            // always necessary
    this.lockType          = config['lockType'];        // optional, if no lock type is configured a MC is assumed.
                                                        //           possible options for lockType are:
                                                        //            - 'MC' for a Motor Cylinder
                                                        //            - 'DC' for a Door Controller
                                                        //            - 'RC' for a Rimlock Controller
 
    this.unlockPin         = config['unlockPin'];       // always necessary
    this.lockPin           = config['lockPin'];         // optional
    this.privacyPin        = config['privacyPin'];      // optional
    this.blockPin          = config['blockPin'];        // optional

    this.battLowPin        = config['battLowPin'];      // optional
    this.commErrorPin      = config['commErrorPin'];    // optional
    this.privStatePin      = config['privStatePin'];    // optional
    this.blockStatePin     = config['blockStatePin'];   // optional
    this.lockStatePin      = config['lockStatePin'];    // optional
    this.doorSensorPin     = config['doorSensorPin'];   // optional

    this.manufacturer      = config['manufacturer'];    // optional, can be used to overwrite the manufacturer name.
    this.serialNumber      = config['serialNumber'];    // optional, can be used to overwrite or set the serialnumber.

    this.logging           = config['logging'];         // optional, default is 'on', set to 'off' to disable logging.
    this.debug             = config['debug'];           // optional, defauly is 'off', set to 'on' to enable debug logging.
    
    this.monitorInterval   = config['monitorInterval']; // optional, time in milliseconds, default is 1111ms.
    this.battLowBulb       = config['battLowBulb'];     // optional, if set to 'yes' a light bulb icon is added as an
                                                        //           battery low indicator.
    this.lockStateOption   = config['lockStateOption']; // optional, can be used to use the door sensor or a combination
                                                        //           of the LOCK state and the door sensor as LOCK state. 
                                                        //           the options are:
                                                        //            - 'LS'  for LOCK State only, this is the default value.
                                                        //            - 'DS'  for Door Sensor only, the door sensor is used as LOCK state.
                                                        //            - 'AND': - the LOCK state is CLOSED if both are CLOSED.
                                                        //                     - the LOCK state is OPENED in all other situations.
    this.activatedServices = [];

    var thiz = this;
    var initializedSupplementaryServices = 0;

    // Write the version of the homebridge-simplex plugin and the logging status to the log.
    //
    var version = require('./package.json').version;
    this.log('...using homebridge-simplex plugin version %s', version);
    
    if(this.debug == 'on')
    {
        this.logging = 'on';
        this.log('\033[33mLogging including DEBUG information is turned ON.\033[0m');
    }
    else if(this.logging != 'off') this.log('\033[33mLogging is turned ON.\033[0m');
    else this.log('\033[33mLogging is turned OFF.\033[0m');

    // Initialize the bmc2835 library and use the physical pin numbering of the extention header.
    // rpio is used so we don't have to run homebridge as root. 
    rpio.init();

    // Initialize the basic lock services and the supplementary lock services
    if(this.initBasicServices())
    {
        initializedSupplementaryServices = this.initSupplementaryServices();
        this.log('\033[33mThe basic lock services and %s supplementary services are initialized.\033[0m', initializedSupplementaryServices);
    }
    else process.exit(1); 
    
    //Start monitoring the all available state.
    if(this.lockStatePin || initializedSupplementaryServices)
    {
        if(!this.monitorInterval) this.monitorInterval = 1111;
        setTimeout(function(){thiz.updateState();},thiz.monitorInterval);
        if(this.debug == 'on') this.log('\033[36mStarted monitoring the available Simplex state with an interval of %s ms.\033[0m', this.monitorInterval);
    }
}




// Function to give all initialized services to homebridge
//
SimplexLockAccessory.prototype.getServices = function()
{
    return this.activatedServices;
}




// Function to handle a LOCK state request.
//
SimplexLockAccessory.prototype.getLockState = function(callback)
{
    var locked   = Characteristic.LockTargetState.SECURED;
    var unlocked = Characteristic.LockTargetState.UNSECURED;
   
    var lockState = this.LockExpectedState;
    if(this.lockStatePin) 
    {
        var lockState = rpio.read(this.lockStatePin);
        if(this.lockStateOption == 'DS') lockState = (lockState == rpio.LOW) ? locked : unlocked;
        else if(this.lockStateOption != 'AND') lockState = (lockState == rpio.LOW) ? unlocked : locked;
        else if(rpio.read(this.doorSensorPin) == rpio.HIGH) lockState = unlocked;
    }
    this.lockService.setCharacteristic(Characteristic.LockCurrentState, lockState);
    this.lockCurrentState = lockState;
    if(this.debug == 'on') this.log('\033[36mFunction getLockState was called and returned the state %s.\033[0m', (lockState == unlocked) ? 'UNLOCKED' : 'LOCKED');
    callback(this.commError, lockState);
}




// Function for processing the 'LOCK' and 'UNLOCK' commands.
//
SimplexLockAccessory.prototype.setLockState = function(targetState, callback)
{
    var locked   = Characteristic.LockTargetState.SECURED;
    var unlocked = Characteristic.LockTargetState.UNSECURED;
    var thiz = this;
    
    this.lockTargetState = targetState;
    if(this.lockEqualState || this.lockStateChange)
    {
        this.lockStateChange = true;
        if(this.logging != 'off') this.log("Set LOCK state to %s by a homekit device.", (targetState == locked) ? " LOCKED " : "UNLOCKED");
        if(targetState == locked) this.pinAction(thiz.lockPin, 0, 1000);
        else this.pinAction(thiz.unlockPin, 0, 1000);
    }
    
    if(this.lockStatePin) this.lockEqualState = false;
    else this.lockService.setCharacteristic(Characteristic.LockCurrentState, targetState);
    this.LockExpectedState = targetState;
    callback(this.commError);
}




// Function to handle a BLOCK state request.
//
SimplexLockAccessory.prototype.getBlockState = function(callback)
{
    var blockState = false; 
    if(this.blockStatePin) blockState = (rpio.read(this.blockStatePin) == rpio.LOW) ? true : false;
    else blockState = (rpio.read(this.blockPin) == rpio.LOW) ? true : false;
    if(this.debug == 'on') this.log('\033[36mFunction getBlockState was called and returned the state %s.\033[0m', (blockState) ? 'ON' : 'OFF');
    callback(this.commError, blockState);
}




// Function for processing the BLOCK commands.
//
SimplexLockAccessory.prototype.setBlockState = function(targetState, callback)
{
    var thiz = this;
    if(this.blockEqualState || this.blockStateChange)
    {
        if(this.logging != 'off') this.log("Set BLOCK state to %s by a homekit device.", (targetState) ? "ON" : "OFF");
    }
    if(targetState) this.pinAction(thiz.blockPin, 0, 0);
    else this.pinAction(thiz.blockPin, 1, 0);
    this.blockStateChange = true;
    if(this.blockStatePin) this.blockEqualState = false;
    callback(this.commError);
}




// Function to handle a PRIVACY state request.
//
SimplexLockAccessory.prototype.getPrivacyState = function(callback)
{
    var privacyState = false; 
    if(this.privStatePin) privacyState = (rpio.read(this.privStatePin) == rpio.LOW) ? true : false;
    else privacyState = (rpio.read(this.privacyPin) == rpio.LOW) ? true : false;
    if(this.debug == 'on') this.log('\033[36mFunction getPrivacyState was called and returned the state %s.\033[0m', (privacyState) ? 'ON' : 'OFF');
    callback(this.commError, privacyState);
}




// Function for processing the PRIVACY commands.
//
SimplexLockAccessory.prototype.setPrivacyState = function(targetState, callback)
{
    var thiz = this;
    if(this.privacyEqualState || this.privacyStateChange)
    {
        if(this.logging != 'off') this.log("Set PRIVACY state to %s by a homekit device.", (targetState) ? "ON" : "OFF");
    }
    if(targetState) this.pinAction(thiz.privacyPin, 0, 0);
    else this.pinAction(thiz.privacyPin, 1, 0);
    this.privacyStateChange = true;
    if(this.privStatePin) this.privacyEqualState = false;
    callback(this.commError);
}




// Function to handle a BATTERY_LEVEL request.
// Because we down't have a real battery level, 95% is return if battLowPin = INACIVE
// and 15% is returned if battLowPin = ACTIVE.
// This function is add only because BatteryLevel is a required characteristic of the Battery Service.
//
SimplexLockAccessory.prototype.getBatteryLevel = function(callback)
{
    var batteryLevel = (rpio.read(this.battLowPin) == rpio.LOW) ? 15 : 95;
    if(this.debug == 'on') this.log('\033[36mFunction getBatteryLevel was called and returned %s\%.\033[0m', batteryLevel);
    callback(this.commError, batteryLevel);
}




// Function to handle a BATTERY_CHARGING_STATE state request.
// Because we don't charge batteries, the NOT_CHARGING state is always returned.
// This function is add only because ChargingState is a required characteristic of the Battery Service.
//
SimplexLockAccessory.prototype.getBatteryChargingState = function(callback)
{
    if(this.debug == 'on') this.log('\033[36mFunction getBatteryChargingState was called and returned the state NOT CHARGING.\033[0m');
    callback(this.commError, Characteristic.ChargingState.NOT_CHARGING);
}




// Function to handle a BATTERY LOW state request.
//
SimplexLockAccessory.prototype.getLowBatteryState = function(callback)
{
    var batteryLowState;
    var batteryLowText = 'BATTERY OK';
    if(this.battLowBulb == 'yes')
    {
        batteryLowState = false;
        if(rpio.read(this.battLowPin) == rpio.LOW)
        { 
            batteryLowState = true;
            batteryLowText  = 'REPLACE BATTERY';
        }
    }
    else
    {
        batteryLowState = Characteristic.LowBattery.BATTERY_LEVEL_NORMAL;
        if(rpio.read(this.battLowPin) == rpio.LOW)
        {
            batteryLowState = Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
            batteryLowText  = 'REPLACE BATTERY';
        }
    }
    if(this.debug == 'on') this.log('\033[36mFunction getBatteryState was called and returned the state %s.\033[0m', batteryLowText);
    callback(this.commError, batteryLowState);
}




// Function to handle a DOORSENSOR state request.
//
SimplexLockAccessory.prototype.getDoorSensorState = function(callback)
{
    var closed = Characteristic.ContactSensorState.CONTACT_DETECTED;
    var opened = Characteristic.ContactSensorState.CONTACT_DETECTED;

    var doorSensorState = (rpio.read(this.doorSensorPin) == rpio.LOW) ? closed : opened;
    if(this.debug == 'on') this.log('\033[36mFunction getDoorSensorState was called and returned the state %s.\033[0m', (doorSensorState == closed) ? 'CLOSED' : 'OPENED');
    callback(this.commError, doorSensorState);
}




// Function updateState takes care of updating all available states.
// It is activated repeatedly on a timer.
//
SimplexLockAccessory.prototype.updateState = function()
{
    var thiz = this;
    
    // Check and update the LOCK state
    if(this.lockStatePin)
    {
        var locked    = Characteristic.LockTargetState.SECURED;
        var unlocked  = Characteristic.LockTargetState.UNSECURED;
        
		var lockState = rpio.read(this.lockStatePin);
        if(this.lockStateOption == 'DS') lockState = (lockState == rpio.LOW) ? locked : unlocked;
        else if(this.lockStateOption != 'AND') lockState = (lockState == rpio.LOW) ? unlocked : locked;
        else if(rpio.read(this.doorSensorPin) == rpio.HIGH) lockState = unlocked;
        this.lockService.setCharacteristic(Characteristic.LockCurrentState, lockState);
        this.lockCurrentState = lockState;
        if(((this.lockCurrentState) == (this.lockTargetState)) && (this.lockEqualState == false))
        {
            this.lockEqualState  = true;
            this.lockStateChange = false;
            if(this.logging != 'off') this.log('The LOCK state is %s now.', (lockState == unlocked) ? 'UNLOCKED' : ' LOCKED ');
        }
        if(this.lockEqualState)
        {
            if((this.lockCurrentState) != (this.lockTargetState))
            {
                if(this.logging != 'off') this.log("The LOCK state changed to %s by an external event.", (lockState == unlocked) ? 'UNLOCKED' : ' LOCKED ');
                this.lockEqualState = false;
                this.lockService.setCharacteristic(Characteristic.LockTargetState, lockState);
            }
        }
    }

    // Check and update the BLOCK state.
    if(this.blockStatePin)
    {
        var blockStateIN  = rpio.read(this.blockStatePin);
        var blockStateOUT = rpio.read(this.blockPin);

        if((blockStateIN == blockStateOUT) && (this.blockEqualState == false))
        {
            this.blockEqualState  = true;
            this.blockStateChange = false;
            if(this.logging != 'off') this.log('The BLOCK state is %s now.', (blockStateIN) ? 'OFF' : 'ON');
        }
        if(this.blockEqualState)  
        {
            if(blockStateIN != blockStateOUT)
            {
                if(this.logging != 'off') this.log("The BLOCK state changed to %s by an external event.", (blockStateIN) ? "OFF" : "ON");
                this.blockEqualState = false;
                this.blockService.setCharacteristic(Characteristic.On, !blockStateIN);
            }
        }
    }
    
    // Check and update the PRIVACY state.
    if(this.privStatePin)
    {
        var privacyStateIN  = rpio.read(this.privStatePin);
        var privacyStateOUT = rpio.read(this.privacyPin);

        if((privacyStateIN == privacyStateOUT) && (this.privacyEqualState == false))
        {
            this.privacyEqualState  = true;
            this.privacyStateChange = false;
            if(this.logging != 'off') this.log('The PRIVACY state is %s now.', (privacyStateIN) ? 'OFF' : 'ON');
        }
        if(this.privacyEqualState)  
        {
            if(privacyStateIN != privacyStateOUT)
            {
                if(this.logging != 'off') this.log("The Privacy state changed to %s by an external event.", (privacyStateIN) ? "OFF" : "ON");
                this.privacyEqualState = false;
                this.privacyService.setCharacteristic(Characteristic.On, !privacyStateIN);
            }
        }
    }

    // Check and update the BATTERY LOW state.
    if(this.battLowPin)
    {
        var batteryLowState;
        var batteryLowText = 'OFF (battery ok)';
    
	    if(this.battLowBulb == 'yes')
        {
            batteryLowState = false;
            if(rpio.read(this.battLowPin) == rpio.LOW)
            {
                batteryLowState = true;
                batteryLowText  = 'ON (replace battery)';
            }
            this.altBatteryService.setCharacteristic(Characteristic.On, batteryLowState);
        }
        else
        {
            batteryLowState = Characteristic.LowBattery.BATTERY_LEVEL_NORMAL;
            if(rpio.read(this.battLowPin) == rpio.LOW)
            {
                batteryLowState = Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
                batteryLowText  = 'ON (Replace battery)';
            }
            this.batteryService.setCharacteristic(Characteristic.StatusLowBattery, batteryLowState);
        }
       
        if(batteryLowState != this.battLowState)
        {
            this.battLowState = batteryLowState;
            if(this.logging != 'off') this.log('The BATTERY LOW state is %s now.', batteryLowText);
        }
    }

    // Check and update the DOORSENSOR state.
    if(this.doorSensorPin)
    {
        var closed = Characteristic.ContactSensorState.CONTACT_DETECTED;
        var opened = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    
        var doorSensorState = (rpio.read(this.doorSensorPin) == rpio.LOW) ? closed : opened;
        if(doorSensorState != this.doorSensorState)
        {
            this.doorSensorState = doorSensorState;
            if(this.logging != 'off') this.log('The DOOR SENSOR state is %s now.', (doorSensorState == closed) ? 'CLOSED' : 'OPENED');
        }
        this.doorSensorService.setCharacteristic(Characteristic.ContactSensorState, doorSensorState);
    }

    // Communication Error monitoring, checks for communication error
    if(this.commErrorPin)
    {
        this.commError = (rpio.read(this.commErrorPin) == rpio.LOW) ? 1 : 0;
        if(this.commError != this.oldCommError)
        {
            this.oldCommError = this.commError; 
            if(this.debug == 'on') this.log('\033[36mThe communication Error monitoring state changed to: %s\033[0m', (this.commError == 0) ? 'COMM.OK.' : 'COMM.ERROR!');
        }
    }

    // Reactivate the updateState function on timeout.
    setTimeout(function(){thiz.updateState();},thiz.monitorInterval);
}




// Function for control of the output pins.
// rpio is used, so the control of the GPIO is possible without root rights.
// A timeout option is available, they are needed/used for the 'LOCK' and 'UNLOCK' commands.
//
// pin       : the physical pin number of the extention connector (1 .. 40).
// action    : 0 for LOW level, 1 for HIGH level.
// actionTime: after actionTime (in milliseconds) the pin is changed to !action.
//             if actionTime is 0, the gpioPin is changed without timout.
//
// returns 'true' on a correct state change
//
SimplexLockAccessory.prototype.pinAction = function(pin, action, actionTime) 
{
    action = (action == 0) ? rpio.LOW : rpio.HIGH;
    // Write pin state changes to the log for debug purpose
    if(this.debug == 'on')
    {
        var extendedLogMsg = '.';
        if(actionTime) extendedLogMsg =' for ' + actionTime + ' ms.';
        this.log('\033[36mTurning GPIO pin %s to %s%s\33[0m', pin, (action == 0) ? '  ACTIVE (0)' : 'INACTIVE (1)', extendedLogMsg);
    }
    
    // Set the requested pin state and check the result.
    var thiz = this;
    var result = false;
    rpio.write(pin, action);
    result = (rpio.read(pin) == action);
    if(!result) this.log('\033[31m***  ERROR  *** GPIO pin %s state change failure!\033[0m', pin);
 
    // If it was a temporary action (actionTime != 0), execute a inverse action on a timer.
    if(actionTime) setTimeout(function(){thiz.pinAction(pin, (action == 0) ? rpio.HIGH : rpio.LOW, 0);},actionTime);
       
    return result;
}




// Function to configure and check the gpio pin settings.
//
// pin        : the physical pin number
// direction  : 'out' or 'in'
// configName : the name of the pin in the config.json file
// simplexRef : the name of the Simplex command or state.
// error      : 'warning' or 'error'
//
// returns 'true' if there was no error detected.
//
SimplexLockAccessory.prototype.pinConfig = function(pin, direction, configName, simplexRef, error)
{
    if(error == 'warning') error = '\033[33m*** WARNING *** ';
    else error = '\033[31m***  ERROR  *** ';
    var result = false;
    if(!pin)
    {
        this.log('%sCheck your config.json file, %s is not configured!\033[0m',error, configName);
        if(direction == 'in') this.log('\033[33m                If the %s state is needed, an \'expected %s state\' will be used.\033[0m', simplexRef, simplexRef);
    }
    else
    {
        if(direction == 'out')
        {
            // Configure the pin as OUTPUT and make it INACTIVE = HIGH.
            // The inputs of the Simplex Interface Module must be pulled LOW to activate them.
            rpio.open(pin, rpio.OUTPUT, rpio.HIGH);
            if(rpio.read(pin) == rpio.HIGH) result = true; 
            else
            {
                rpio.close(pin);
                this.log('\033[31m***  ERROR  *** It\'s not possible to make pin %s HIGH (1).\033[0m', pin);
            }
        }
        else
        {
            // Configure the pin as INPUT with an activated PULL_UP resistor.
            // The outputs of the Simplex Interface are OC type outputs which will pull to LOW on activation.
            rpio.open(pin, rpio.INPUT, rpio.PULL_UP);
            result = true;   
        }
        if(this.debug == 'on') this.log('\033[36mPin %s is configured as %s for the %s %s.\033[0m', pin, (direction == 'out') ? 'OUTPUT' : 'INPUT ', simplexRef, (direction == 'out') ? 'command' : 'state');    
    }   
    return result;
}




// Function for initializing the basic LOCK services
//
SimplexLockAccessory.prototype.initBasicServices = function()
{
    var result = false;
    var thiz = this;
    
    // The Lock Mechanism Service is used for the basic functions 'LOCK' and 'UNLOCK' of the Simplex product.
    // It is represented with a lock icon in the HomeKit app.
    // The service is only started if a unlockPin is available for the UNLOCK command.
    // 
    if(this.pinConfig(this.unlockPin, 'out', 'unlockPin', 'UNLOCK', 'error'))
    {
        this.lockEqualState     = true;
        this.lockStateChange    = true;
        this.lockTargetState    = 0;
        this.lockCurrentState   = 0;
       
        this.lockService = new Service.LockMechanism(thiz.name);
        this.activatedServices.push(thiz.lockService);

        this.lockService
            .getCharacteristic(Characteristic.LockCurrentState)
            .on('get', this.getLockState.bind(this));

        this.lockService
            .getCharacteristic(Characteristic.LockTargetState)
            .on('get', this.getLockState.bind(this))
            .on('set', this.setLockState.bind(this));

        if(this.debug == 'on') this.log('\033[36mBasic lock services (LockMechanism) added to the list of available services.\033[0m');

        result = true;
    
        // Check for a lockPin and configure it. 
        if(!this.pinConfig(this.lockPin, 'out', 'lockPin', 'LOCK', 'warning'))
        {
            this.log('\033[33m                If you don\'t need the LOCK function, you can ignor this warning.\033[0m');
        }

        // An expected lock state is needed for 'MC' and 'RC' types, or when no lockStatePin is configured.
        // The 'MC' and 'RC' type locks don't return the lock state because it is unknown.
        //
        this.LockExpectedState = Characteristic.LockCurrentState.UNSECURED;

        // Take care of the lockStateOption.
        //
        if(this.lockStateOption == 'DS')
        {
            if(this.doorSensorPin)
            {
                this.lockStatePin = this.doorSensorPin; 
                if(this.debug == 'on') this.log('\033[36mThe DOOR SENSOR state will be used as LOCK state!\033[0m');
                else this.log('\033[31m***  ERROR  *** The DOOR SENSOR state cannot be used for the LOCK state!\033[0m');
            }
        }
        if(this.lockStateOption == 'AND')
        {
            if(!(this.lockStatePin && this.doorSensorPin)) 
            {
                if(this.debug == 'on') this.log('\033[36mThe DOOR SENSOR state AND the LOCK state will be used as LOCK state!\033[0m');
                else this.log('\033[31m***  ERROR  *** The DOOR SENSOR state AND the LOCK state cannot be used for the LOCK state!\033[0m');
            }
        }
    
        // Check for a lockStatePin and configure it.
        this.pinConfig(this.lockStatePin, 'in', 'lockStatePin', 'LOCK', 'warning');

        // The Accessory Information Service provides the information about Manufacturer, Serialnumber and the Model
        // of the Simplex product. This information is available in the 'Home' app.
        // The default values are respectively 'Simplex', 'no specified' and 'Motorized Cylinder'.
        //
        this.infoService = new Service.AccessoryInformation();
        this.activatedServices.push(thiz.infoService);
 
        // The Model of the product is derived from lockType. If no lockType is configured, it defaults to 'MC'.
        //
        if(!this.lockType) this.lockType = 'MC';
        var lockTypeName = 'Motorized Cylinder';
        if(this.lockType == 'DC') lockTypeName = 'Door Controller';
        else if (this.lockType == 'RC') lockTypeName = 'Rim lock Controller';
        else if (this.lockType != 'MC') this.log('\033[31m***  ERROR  *** Check your config.json file, wrong lockType! Use \'MC\', \'RC\' or \'DC\'.\033[0m');

        this.infoService
            .setCharacteristic(Characteristic.Manufacturer, (thiz.manufacturer) ? thiz.manufacturer : 'Simplex')
            .setCharacteristic(Characteristic.Model, lockTypeName)
            .setCharacteristic(Characteristic.SerialNumber, (thiz.serialNumber) ? thiz.serialNumber : 'not specified');

        if(this.debug == 'on') this.log('\033[36mInformation service (AccessoryInformation) added to the list of available services.\033[0m');

        if(this.logging != 'off') this.log('The %s %s with serialnumber %s is added to Homebridge.',(this.manufacturer) ? this.manufacturer : 'Simplex', lockTypeName,(this.serialNumber) ? this.serialNumber : 'not specified');
    }
    return result;
}




// Function for initializing the available supplementary services like:
// BLOCK, PRIVACY, BATTERY LOW, DOOR SENSOR and COMM.ERROR.
//
SimplexLockAccessory.prototype.initSupplementaryServices = function()
{
    var result = 0;
    var thiz = this;

    // BLOCK service
    //
    if(this.pinConfig(this.blockPin, 'out', 'blockPin', 'BLOCK', 'warning'))
    {   
        this.blockEqualState  = true;
        this.blockStateChange = true;

        this.blockService = new Service.Switch('Block', 'Block');
        this.activatedServices.push(thiz.blockService);

        this.blockService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getBlockState.bind(this))
            .on('set', this.setBlockState.bind(this));

        this.pinConfig(this.blockStatePin, 'in', 'blockStatePin', 'BLOCK', 'warning');
        if(this.debug == 'on') this.log('\033[36mBlock service (Switch) added to the list of available services.\033[0m');
        result++;
    }
    
    // PRIVACY service
    //
    if(this.pinConfig(this.privacyPin, 'out', 'privaycPin', 'PRIVACY', 'warning'))
    {
        this.privacyEqualState  = true;
        this.privacyStateChange = true;

        this.privacyService = new Service.Switch('Privacy', 'Privacy');
        this.activatedServices.push(thiz.privacyService);
    
        this.privacyService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getPrivacyState.bind(this))
            .on('set', this.setPrivacyState.bind(this));

        this.pinConfig(this.privStatePin, 'in', 'privacyStatePin', 'PRIVACY', 'warning');
        if(this.debug == 'on') this.log('\033[36mPrivacy service (Switch) added to the list of available services.\033[0m');
        result++;    
    }

    // BATTERY LOW service
    // There are two options implemented:
    // 1. The HomeKit battery service which is not widely supported.
    // 2. The alternative battery low indication with a light bulb.
    //
    if(this.pinConfig(this.battLowPin, 'in', 'battLowPin', 'BATTERY_LOW', 'warning'))
    {
        if(this.battLowBulb == 'yes')
        {
            this.battLowState = true;

            this.altBatteryService = new Service.Lightbulb('Replace Battery', 'Replace Battery');
            this.activatedServices.push(thiz.altBatteryService);
    
            this.altBatteryService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getLowBatteryState.bind(this));

            if(this.debug == 'on') this.log('\033[36mAlternative battery service (Lightbulb) added to the list of available services.\033[0m');
        }
        else
        {
            this.batteryService = new Service.BatteryService(thiz.name);
            this.activatedServices.push(thiz.batteryService);
   
            this.batteryService
                .getCharacteristic(Characteristic.BatteryLevel)
                .on('get', this.getBatteryLevel.bind(this))

            this.batteryService
                .getCharacteristic(Characteristic.ChargingState)
                .on('get', this.getBatteryChargingState.bind(this))

            this.batteryService
                .getCharacteristic(Characteristic.StatusLowBattery)
                .on('get', this.getLowBatteryState.bind(this))

            if(this.debug == 'on') this.log('\033[36mBattery service (BatteryService) added to the list of available services.\033[0m');
        }
        result++;    
    }

    // DOOR SENSOR service, checks the state of the door position sensor.
    //
    if(this.pinConfig(this.doorSensorPin, 'in', 'doorSensorPin', 'DOOR SENSOR', 'warning'))
    {
        this.doorSensorState = 0;

        this.doorSensorService = new Service.ContactSensor('Door Sensor', 'Door Sensor');
        this.activatedServices.push(thiz.doorSensorService);
    
        this.doorSensorService
            .getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getDoorSensorState.bind(this));

        if(this.debug == 'on') this.log('\033[36mDoor sensor service (ContactSensorService) added to the list of available services.\033[0m');
        result++;    
    }

    // COMM.ERROR monitoring, checks for communication error.
    //
    if(this.pinConfig(this.commErrorPin, 'in', 'commErrorPin', 'COMM_ERROR', 'warning'))
    {
        this.oldCommError = 0;
        this.commError = (rpio.read(this.commErrorPin) == rpio.LOW) ? 1 : 0;
        if(this.debug == 'on') this.log('\033[36mCommunication Error monitoring activated.\033[0m');
        result++;
    }
    else this.commError = 0;

    // Return how many supplementary services are activated
    //
    return result;
}
