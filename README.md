
# homebridge-simplex
Use your Simplex locks with Homekit
</br></br>

Version: 0.9.0

Release date: 20170101

## homebridge-simplex, a short introduction
homebridge-simplex is a way to use your Simplex locks with Homekit. It is also the name of a plugin for homebridge on a Raspberry Pi.

The Simplex locks are sold in Europe in various variations and under different names. In The Netherlands they are sold under the names Flexeria, CESeasy and Telelock. In other European countries they are sold under the names eWizz (UK) and CESeasy.

homebridge-simplex is made by a hobbyist to be used by hobbyists. It is free available at github (https://github.com/simplexjunkie/homebridge-simplex) to use, change and improve.

All other necessary software like the Linux OS, Homebridge, HAP-nodejs, node-rpio and all there dependencies are also available for free. Thanks to all the authors of all these software packages, homebridge-simplex was not possible without their work.

This document is intent to be a installation manual for homebridge-simplex from scratch. From scratch in this context is starting with an Raspberry Pi without OS installed. All necessary steps are in this document. So when you start at the beginning and do every step as described, you will end with a working solution.

## What is required for homebridge-simplex

To make your own homebridge-simplex you will need a little knowledge of computers and hardware. You also need a the following stuff:
*	A Raspberry Pi 2B or 3B
*	A good quality Class 10 SD card for the RPi
*	A power supply for the RPi
*	An Ethernet LAN connection with internet access
*	A computer with SSH client, or a monitor and keyboard for the RPi. In this document it is assumed that a computer with SSH client is used.
*	A Simplex lock (Motorized Cylinder, Door Controller or Rim lock Controller)
*	A Simplex Communication Interface
*	A 40 pin header connector with flat cable to connect the RPi with the Simplex Communication Interface. An IDE cable from an old HDD can do the job.
*	The drive and spirit to make it work !

## How to start

When you have collected all the required stuff, you can start at the next chapter “Raspberry Pi from the beginning”. Do not skip that part, all other chapters rely on the OS installation as described.
 
## Raspberry Pi from the beginning

Follow the steps below for a headless (Raspberry Pi without keyboard and monitor) installation. Most of the information can also be found on https://www.raspberrypi.org/documentation/raspbian/.
*	Get the latest raspbian-jessie-lite.img from https://www.raspberrypi.org/downloads/raspbian/.
*	Write the image to a good quality Class 10 SD card.
*	Before you remove the SD card from your computer, write an empty file with the name ‘ssh’, without any extension onto the boot partition of the SD card.
(From a default Windows computer, this is the only accessible partition after you have written the image to the card.)
*	Be sure your Raspberry Pi is not connected to any power source!
*	Remove the SD card from your computer and place it into the Raspberry Pi.
*	Connect the Raspberry Pi to an active LAN with DHCP enabled. Internet access must be possible from this LAN connection for the Raspberry Pi.
*	Power up the Raspberry Pi.
*	The default hostname of the Raspberry Pi is ‘raspberrypi’, so start a SSH client (for example PuTTY, http://www.putty.org) and connect to the host ‘raspberrypi’.
*	Login with the default user ‘pi’ and use the default password ‘raspberry’.
*	Update all the packages with:

  `sudo apt-get update`
  
  `sudo apt-get dist-upgrade`
  
*	For the configuration of the Raspberry Pi use:

  `sudo raspi-config`
  
*	If you like you can expand the filesystem of the Raspberry Pi to all available space on the SD card.
*	From security perspective it is a good idea to change the password of the user ‘pi’. Remember it, you need it at the next login!
*	Set up your language and regional settings. Use an UTF-8 locales!
*	Set up the correct timezone.
*	If you have a Raspberry PI 3, set up the correct WiFi Country.
*	Under advanced options you can change the hostname, set it to for example to ‘homebridge’ or ‘homebridge-simplex’. Remember it, you need it at the next SSH session!
*	Finish and reboot.
*	Restart your SSH client, connect to the Raspberry Pi by using the new hostname.
*	Login as the user ‘pi’ and use the new password.
*	Do the things you want. For further preparation of the Raspberry Pi and the installation of homebridge-simplex follow the next section.

## Installation of homebridge-simplex and all the dependencies

Follow the steps below for (further) preparation of the Raspberry Pi and installation of homebridge-simplex.
*	Prepare your Raspberry Pi as in the previous chapter.
*	It is a good idea to give the Raspberry Pi a fixed IP address because it will be used as a bridge. If you are not already logged in, login as user ‘pi’ and open /etc/dhcpd.conf for editing by executing the command:

  `sudo nano /etc/dhhpcd.conf`

*	Add at the beginning of the file the following code. (Fill in your own IP addresses. Use for ip_address the CIDR notation.)

  ```
interface eth0
static ip_address=192.168.0.10/24
static routers=192.168.0.1
static domain_name_servers=192.168.0.1
 ```

  Comment: the routers address is the address of the default gateway.
*	After you have edited and saved the file, you have to reboot the Raspberry Pi with the command:

  `sudo shutdown -r now`

*	Restart your SSH client, connect to the Raspberry Pi by using the hostname or the new IP address.
*	Login as the user ‘pi’.
*	Before you install nodejs, be sure you are using a Raspberry Pi2B or 3B. They have an ARMv7 or ARMv8 chip which can be checked with the command:

  `uname -m`

*	Update the apt package repository, so it will include de Node source packages, with the command:

  `curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash –`

*	Install nodejs with the command:

  `sudo apt-get install -y nodejs`

*	Install Avahi with the command:

  `sudo apt-get install libavahi-compat-libdnssd-dev`

*	Install homebridge and its dependencies with the following commands:

  `sudo npm install -g --unsafe-perm homebridge hap-nodejs node-gyp`

  `cd /usr/lib/node_modules/homebridge`

  `sudo nmp install --unsafe-perm bignum`

  `cd /usr/lib/node_modules/hap-nodejs/node_modules/mdns`

  `sudo node-gyp BUILDTYPE=Release rebuild`

*	Install node-rpio with the command:

  `sudo npm install -g rpio`

*	install git with the command:

  `sudo apt-get install git`

*	Add a new system user ‘homebridge’ for homebridge with the command:

  `sudo adduser --system homebridge`

*	Add the new system user ‘homebridge’ to the group gpio with the command:

  `sudo usermod -a -G gpio homebridge`
 
*	Install the homebridge-simplex plugin:

  `mkdir ~/temp`

  `cd ~/temp`

  `git clone https://github.com/simplexjunkie/homebridge-simplex.git`

  `cd homebridge-simplex`

  `sudo tar -C / -xf homebridge-simplex.tar`

*	Configure homebridge-simplex by following the chapter ‘Configuration of homebridge-simplex’.
*	Activate the start of homebridge at boot time with the commands:

  `sudo systemctl daemon-reload`

  `sudo systemctl enable homebridge`

  `sudo systemctl start homebridge`

*	Now you can remove the temporary directory ~/temp if you want with the commands:

  `cd ~`
  `sudo rm -R temp`

*	The installation of homebridge-simplex is ready!
*	Reboot the Raspberry Pi with the command:

  `sudo shutdown -r now`

*	Reconnect your SSH client, login again and check homebridge is running with the command:

  `systemctl status homebridge`

#### Stopping homebridge and shutting down the Raspberry Pi

If you want to stop homebridge after it is started by systemd, use the command:

`sudo systemctl stop homebridge`

If you want to power down your Raspberry Pi, login and give the following command. After you have entered the command, give it 15 seconds to shut down before removing the power:

`sudo shutdown -h now`

If you power down your Raspberry Pi without the shutdown command, you risk a damaged filesystem on your SD card!

## Configuration of homebridge-simplex
The configuration of homebridge-simplex needs to be done in the config.json file of homebridge. After installation accordance with this document, there is a default config.json in the directory /var/homebridge, which has the following content:
```json
{
   "bridge" :
   {
       "name"     : "Homebridge Simplex",
       "username" : "CD:22:3D:E3:CE:31",
       "port"     :  51826,
       "pin"      : "031-45-154"
   },

   "description" : "Homebridge Simplex Config file",

   "accessories" :
   [
       {
           "accessory"       : "SimplexLock",
           "name"            : "Frontdoor",
           "unlockPin"       :  11,
           "lockPin"         :  12,
       }
   ],

   "platforms" :
   [
   ]
}
```

The “bridge” part is the part that belongs to Homebridge itself. The configuration for the Simplex lock(s) is done in the “accessories” part of the file. You can edit the file with the command:

`sudo nano /var/homebridge/config.json`

For security reason it is a good idea to change the pin in the “bridge” part!

If you have more than one Homebridge you also have to change the username in the “bridge” part of the file. You can use the MAC address of your Raspberry Pi as username.

In the table below you will find all possible settings and options for the Simplex locks in the “accessories” part of the file. Edit them to your needs and save your changes.


| Name            | Required  |	Specification                                                                       |
|-----------------|:---------:|-------------------------------------------------------------------------------------|
| accessory       | mandatory | Must be “SimplexLock” for all types of Simplex locks!                               |
| name            | mandatory | The name of the door or lock. This name will be used in Homekit.                    |
| unlockPin       | mandatory | The RPi pin* which is connected to  **IN1** of the Simplex Communication Interface. |
| lockPin         | optional  | The RPi pin* which is connected to  **IN2** of the Simplex Communication Interface. |
| privacyPin      | optional  | The RPi pin* which is connected to  **IN3** of the Simplex Communication Interface. |
| blockPin        | optional  | The RPi pin* which is connected to  **IN4** of the Simplex Communication Interface. |
| battLowPin      | optional  | The RPi pin* which is connected to **OUT1** of the Simplex Communication Interface. |
| commErrorPin    | optional  | The RPi pin* which is connected to **OUT2** of the Simplex Communication Interface. |
| privStatePin    | optional  | The RPi pin* which is connected to **OUT3** of the Simplex Communication Interface. |
| blockStatePin   | optional  | The RPi pin* which is connected to **OUT4** of the Simplex Communication Interface. |
| lockStatePin    | optional  | The RPi pin* which is connected to **OUT5** of the Simplex Communication Interface. |
| doorSensorPin   | optional  | The RPi pin* which is connected to **OUT6** of the Simplex Communication Interface. |
| serialNumber    | optional  | Can be used to overwrite the default serial number information in HomeKit.          |
| manufacturer    | optional  | Can be used to overwrite the manufacturer name, for example with the name of the distributor. |
| lockType        | optional  |- Use `"MC"` for Motorized Cylinder (default).</br>- Use `"DC"` for a Door Controller.</br>- Use `"RC"` for a Rim lock Controller.|
| battLowBulb     | optional  | If set to `"yes"` a light bulb icon is added as a visible battery low indication as an alternative solution for the Homekit implementation. |
| lockStateOption | optional  | Can be used to use the door sensor or a combination of the door sensor and the lock state as a lock state indication. The options are:</br>- `“LS”` only the lock state will be used as lock state indication (default).</br>- `"DS"`	only the door sensor will be used as lock state indication.</br>- `"AND"`	the lock state indication is CLOSED if both the door sensor and the lock state are CLOSED. In all other situations the lock state indication is OPENED. |
| logging         | optional  | If set to `"no"`, no logging information will be generated. The default is `"yes"`. |
| debug           | optional  | If set to `"yes"`, additional debug information is generated. Use this option on a first test after configuration. The value of the logging option has no effect on the debug option. |

\* *For the RPi pin numbers, the physical pin number of the 40 pin extension header must be used. Please take a look at the chapter “Connection between the RPi and the Simplex Communication Interface”.*

It’s a good idea to test your configuration with the option `"debug" : "on"`. For testing purpose you can start homebridge with the command:

`homebridge -U /var/homebridge`

If you do so, you will have all logging visible in your terminal. You can stop homebridge with ctrl-C. Once you are satisfied with the results, you can finish the last steps of the installation part of homebridge-simplex, so homebridge will start automatically on boot time.

### config.json examples with all options and settings available

Below you will find an example of a Simplex lock configuration with all settings and options in it. If you are not familiar with the JSON format, you can check the content of your edited file with an online JSON validator.

```json
{
    "bridge" :
    {
        "name"     : "Homebridge Simplex",
        "username" : "CD:22:3D:E3:CE:31",
        "port"     :  51826,
        "pin"      : "031-45-154"
    },

    "description" : "Homebridge Simplex Config file",

    "accessories" :
    [
        {
            "accessory"       : "SimplexLock",
            "name"            : "Frontdoor",
            "unlockPin"       :  11,
            "lockPin"         :  12,
            "privacyPin"      :  13,
            "blockPin"        :  15,
            "battLowPin"      :  16,
            "commErrorPin"    :  29,
            "privStatePin"    :  31,
            "blockStatePin"   :  32,
            "lockStatePin"    :  33,
            "doorSensorPin"   :  35,
            "serialNumber"    : "10012-345",
            "manufacturer"    : "DistributorName",
            "lockType"        : "DC",
            "battLowBulb"     : "yes",
            "lockStateOption" : "AND",
            "logging"         : "off",
            "debug"           : "on"
        }
    ],

    "platforms" :
    [
    ]
}
```

### Multiple Simplex locks on one Raspberry Pi with homebridge-simplex
If you have connected multiple Simplex Communication Interfaces to the extension header of the Raspberry Pi, you have to configure all locks in the same file. Below an example of an configuration file (config.json) is given with 3 locks in it.

```json
{
    "bridge" :
    {
        "name"     : "Homebridge Simplex",
        "username" : "CD:22:3D:E3:CE:31",
        "port"     :  51826,
        "pin"      : "031-45-154"
    },

    "description" : "Homebridge Simplex Config file",

    "accessories" :
    [
        {
            "accessory"       : "SimplexLock",
            "name"            : "Frontdoor",
            "unlockPin"       :  11,
            "lockPin"         :  12,
        },
        {
            "accessory"       : "SimplexLock",
            "name"            : "Backdoor",
            "unlockPin"       :  38,
            "lockPin"         :  40
        },
        {
            "accessory"       : "SimplexLock",
            "name"            : "Garagedoor",
            "unlockPin"       :  36,
            "lockPin"         :  37
        }
    ],

    "platforms" :
    [
    ]
}
```

## Connection between the RPi and the Simplex Communication Interface

To make communication possible between the Raspberry Pi and a Simplex lock, you need a Simplex Communication Interface for each of your Simplex locks. It is possible to connect the Simplex Communication Interface directly to the GPIO pins of the Raspberry Pi. If the power supply of the Raspberry Pi is powerful enough to power some peripheral, it is also possible to get the power for the Simplex Communication Interface directly from 5V pins of the Raspberry Pi extension header.

|Function   |Pin |Pin |Function    |
|----------:|:--:|:--:|------------|
|3V3        |  1 |  2 | 5V         |
|I2C  GPIO2	|  3 |  4 | 5V         |
|I2C  GPIO3	|  5 |  6 | Ground     |
|GPIO4	    |  7 |  8 | GPIO14 UART|
|Ground     |  9 | 10 | GPIO15 UART|
|GPIO17     | 11 | 12 | GPIO18     |
|GPIO27     | 13 | 14 | Ground     |
|GPIO22     | 15 | 16 | GPIO23     |
|3V3        | 17 | 18 | GPIO24     |
|SPI GPIO10 | 19 | 20 | Ground     |
|SPI  GPIO9 | 21 | 22 | GPIO25     |
|SPI GPIO11 | 23 | 24 | GPIO8  SPI |
|Ground     | 25 | 26 | GPIO7  SPI |
|I2C   D_SD | 27 | 28 | ID_SC  I2C |
|GPIO5      | 29 | 30 | Ground     |
|GPIO6      | 31 | 32 | GPIO12     |
|GPIO13     | 33 | 34 | Ground     |
|GPIO19     | 35 | 36 | GPIO16     |
|GPIO26     | 37 | 38 | GPIO20     |
|Ground     | 39 | 40 | GPIO21     |

*The 40 pin extension header of the Raspberry Pi.*


By default all GPIO pins are configured as inputs. So if you installed homebridge-simplex according to this document on a clean Raspberry Pi, don’t worry about connecting the Simplex Communication Interface to the unused GPIO pins of the Raspberry Pi. In all situations you will handle at your own risk.

If you want to power the Simplex Communication Interface from the extension header, connect the 5V power pins (pin 2 & 4) and at least two ground pins (pin 6 & 14) to the 12VDC and GND input of the Simplex Communication Interface.

### Multiple Simplex locks on one Raspberry Pi with homebridge-simplex
If you want to use more than one Simplex Lock with homebridge-simplex, you have to connect a Simplex Communication Interfaces for each Simplex lock. Connect the inputs and outputs of each Simplex Communication Interface to different GPIO pins on  the extension header of the Raspberry Pi.

Take a look at the chapter ‘Configuration of homebridge-simplex’ for more information.
 
## MIT License

Copyright (c) 2016 simplexjunkie <simplexjunkie@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
