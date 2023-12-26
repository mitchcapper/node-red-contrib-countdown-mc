 # node-red-contrib-countdown-3000

`node-red-contrib-countdown-3000` is a simple countdown node for Node-Red.

This code is based on node-red-contrib-countdown-2 by marc, see here for the general description:

https://github.com/marc-gist/node-red-contrib-countdown

This version is highly compatible with countdown-2 v1.4.2 with the following changes and fixes:

**Changes / Enhancements**

  - **STOP** command fully evaluated - payload can be '0', 'off', 'stop', false or 0.
      -- Not case sensitive.
  - **START** command fully evaluated - payload can be '1', 'on', 'start', true or 1.
      -- Not case sensitive.
     - Start will also cancel a paused count and begin again at the value set in
         the node's GUI interface. If you want to modify the count's start value,
         see the *preload* command below.

  - Node output and node status messages are in seconds or minutes
    to match node config.
  - Countdown goes to zero.
  - Minor syntax changes and code tidies.
  - 
    If any action makes the countdown zero or negative, it will be stopped at zero.

  - **"control"** input is now not case sensitive and can be a number or 
      string with or without a sign:
    - If the input is a plain number, the current countdown is set to 
      that number (in minutes or seconds according to node setting).
    - If the number is a negative integer (eg -10), a string with a plus or 
      minus sign (eg: "+12" or "-12") OR the number is a string or decimal fraction 
      (eg: 10.1 or "10.1" or -10.1 etc) the countdown is increased or decreased by that 
      (truncated) amount (fraction part is discarded). Note that a positive integer
      input with a sign (eg: +10) is treated by javascript as plain old 10, so you can't
      use that method to add amounts to the count; use a fraction or make it a 
      string (eg: 30.1 or "+30").
    - **PAUSE** will pause the countdown. The node will still output its current (paused) 
      value every second. The countdown will resume with the next pause input (in effect,
      'pause' toggles the counter), or if the countdown value is changed as above. 
    - **PRELOAD** will restart a count *at the current set value* (provided it's 
      not zero and the count is not currently running). This allows a count to be stopped, 
      a new value set and the count started from this value rather than the one set in 
      the node's interface. 

# Change Log

## 1.6L: 

- Fixed spurious 'true' output sent under some circumstances.
- Clarified comments about STOP and START commands.

## 1.5.0L and 1.5.1-L (minor text adjustment)
- Code forked from countdown-2 and bug fixes + enhancements applied.

# Original notes from Countdown-2 V1.4.2

**READ IN CONJUNCTION WITH CHANGES LISTED ABOVE**

![node-appearance](images/node-appearance.png "Node appearance")  
**Fig. 1:** Node appearance

<a name="installation"></a>
## Installation

<a name="installation_in_node-red"></a>
### In Node-RED (preferred)
* Via Manage Palette -> Search for "node-red-contrib-countdown-3000"

<a name="installation_in_a_shell"></a>
### In a shell
* go to the Node-RED installation folder, e.g.: `~/.node-red`
* run `npm install node-red-contrib-countdown-3000`

<a name="usage"></a>
## Usage

<a name="node_configuration"></a>
### Node Configuration

![node-settings](images/node-settings.png "Node properties")  
**Fig. 2:** Node properties


#### Countdown (secs) property
Set the ***Countdown*** value to the desired countdown time in seconds. The timer will start with this countdown value to decrease the timer value (countdown start value).  Minutes if the option "Counter is in Minutes" is checked.

#### Topic
The ***Topic*** can be set to any string value. This string is added to the output `msg` as an additional element `msg.topic`.  

**Note:** No value is given to the topic.

#### Timer On payload, Timer Off payload
Set the ***Timer On payload*** to any payload type and value which is sent when the counter starts.  
Set the ***Timer Off payload*** to any payload type and value which is sent when the counter elapses.  
In both cases, also nothing to be emitted may be chosen.

#### Flags
You can configure the timer to
- Timer in Minutes (default is seconds)
- **restart** (reload) the timer to its countdown start value during the count down whenever a `msg` is received at the node's input.
- activate the ability to **set the timer value** to an arbitrary value during the count down with the use of a control `msg`.
- **start the timer** with a control `msg` (i.e. a `msg` with a *control* topic string).

## Input
The node evaluates the following input `msg` types:
- Input `msg` with a `msg.payload` contents of false (boolean) or '0' (number).  
  This `msg` type stops resp. finishes the timer. The *Timer Off payload* is emitted also in this case.
- Input `msg` with a `msg.topic` set to "control" and a `msg.payload` set to an arbitrary number value. This reloads the timer with the desired `msg.payload` value immediately and works at a running countdown as well as a non startet or elapsed countdown timer.  
- All other input `msg` do start/restart the timer if it is stopped.
- See Node configuration for `control` topic options to `cancel` the timer.

## Outputs
The node contains two outputs:
- The **primary output** (upper output) emits an output `msg` at the **countdown start/stop** instant of time.  These `msg.payload` contents are configurable
- The **secondary output** (lower output) emits the **remaining time every second** during the timer runs. The `msg.payload` holds the remaining counting value


## Examples (original)
### Todo: create examples for modified control/stop/etc.

### Basic behaviour
This example shows the basic behaviour with
- starting the timer via an input `msg` (inject node)
- showing the behaviour of the two outputs of the node

Just activate the inject and look at the output debug node status messages.

![Alt text](images/flow-basic.png?raw=true "Basic flow")  
[**basic flow**](examples/FlowBasic.json)  
**Fig. 3:** Basic example flow


### Sending messages and retriggering
This example shows how to
- handle messages at the start and the end of the countdown
- retrigger the timer during it runs

Text messages are output on the first output at start and end of the countdown.  
You can restart the timer by activating the inject node during the countdown runs.

![Alt text](images/flow-retrigger-and-messages.png?raw=true "Sending messages and retrigger flow")  
[**messages and retriggering flow**](examples/FlowRetriggerAndMessages.json)  
**Fig. 4:** Message sending and retriggering example flow



### Stopping the countdown timer
This example shows the two options to stop the countdown timer.

![Alt text](images/flow-stop.png?raw=true "Stopping timer flow")  
[**stopping timer flow**](examples/FlowStop.json)  
**Fig. 5:** Timer stopping example flow



### Reloading the countdown timer
This example shows the functionality of reloading the countdown value during a running timer.


![Alt text](images/flow-reload.png?raw=true "Reloading timer flow")  
[**reloading timer flow**](examples/FlowReload.json)  
**Fig. 6:** Timer reload example flow
