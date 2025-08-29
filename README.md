 # node-red-contrib-countdown-mc

`node-red-contrib-countdown-mc` is a simple countdown node for Node-Red.

This code is based on the improvements by linker3000 in node-red-contrib-countdown-3000 which was based on node-red-contrib-countdown-2 by marc, see here for the general description:
https://github.com/linker3000/node-red-contrib-countdown-3000
https://github.com/marc-gist/node-red-contrib-countdown

A quick example of using this node is to visualize a trigger delay.  Pass the trigger into to a countdown node just set

This version is highly compatible with countdown-2 v1.4.2 and countdown-3000 with the following changes and fixes:

**Changes / Enhancements**

  - **STOP** command fully evaluated - payload can be '0', 'off', 'stop', false or 0.
      -- Not case sensitive.
  - **START** command fully evaluated - payload can be '1', 'on', 'start', true or 1.
      -- Not case sensitive.
     - Start will also cancel a paused count and begin again at the value set in
         the node's GUI interface. If you want to modify the count's start value,
         see the *preload* command below.

  - Node output and node status messages are in seconds, minutes, and potentially hours depending on the time left.
  - Countdown goes to zero.

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

## 2.0.0:

- Added milliseconds support for more precise timing
- Added hours support for longer time spans
- Added high precision option with 100ms updates for any time unit
- Fixed issue with startCountdownOnControlMessage not using the payload time
- Improved UI with dropdown for time unit selection (milliseconds, seconds, minutes, hours)
- Enhanced description for setTimeToNewWhileRunning option for better clarity
- Standardized time display format to show hours, minutes and seconds as appropriate
- Added one decimal place precision for time display when in high precision mode
- Added configurable property input using standard Node-RED property selector instead of forcing message.payload
- Added option to treat any message with a numeric value in the configured property as a control message (without requiring "control" topic)
- Fixed issue with countdown sometimes showing negative values or double events


## 1.6.0:

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
* Via Manage Palette -> Search for "node-red-contrib-countdown-mc"

<a name="installation_in_a_shell"></a>
### In a shell
* go to the Node-RED installation folder, e.g.: `~/.node-red`
* run `npm install node-red-contrib-countdown-mc`

<a name="usage"></a>
## Usage

<a name="node_configuration"></a>
### Node Configuration

![node-settings](images/node-settings.png "Node properties")
**Fig. 2:** Node properties


#### Countdown property
Set the ***Countdown*** value to the desired countdown time. The timer will start with this countdown value to decrease the timer value (countdown start value). Select the time unit (seconds, minutes, milliseconds, or hours) from the dropdown menu next to the countdown value input.

#### Topic
The ***Topic*** can be set to any string value. This string is added to the output `msg` as an additional element `msg.topic`.

**Note:** No value is given to the topic.

#### Timer On payload, Timer Off payload
Set the ***Timer On payload*** to any payload type and value which is sent when the counter starts.
Set the ***Timer Off payload*** to any payload type and value which is sent when the counter elapses.
In both cases, also nothing to be emitted may be chosen.

#### Flags
You can configure the timer to
- Select time unit (Milliseconds, Seconds, Minutes, or Hours) from the dropdown menu
- **restart** (reload) the timer to its countdown start value during the count down whenever a `msg` is received at the node's input.
- activate the ability to **set the timer value** to an arbitrary value during the count down with the use of a control `msg`. If this option is not checked, new time values will only be applied when the timer is not running.
- **start the timer** with a control `msg` (i.e. a `msg` with a *control* topic string).
- use **high precision** timer with 100ms updates instead of the standard 1-second updates (milliseconds mode always uses 100ms updates regardless of this setting).

#### Property
By default, the node uses `msg.payload` for input values. You can configure it to use a different message property by setting the **Property** field. For example, you could set it to read from `msg.time` instead of `msg.payload`. This property can be selected from the message object, flow context, or global context.

## Input
The node can be configured to evaluate from any message property, flow context, or global context instead of the default `msg.payload`. The configured property will be referred to as "the input property" below.

The node evaluates the following input types:
- Input with a property value of false (boolean) or '0' (number).
  This input type stops/finishes the timer. The *Timer Off payload* is emitted also in this case.
- Input with a `msg.topic` set to "control" and the configured property set to an arbitrary number value. This reloads the timer with the desired value immediately and works for a running countdown as well as a stopped or elapsed countdown timer.
- All other inputs start/restart the timer if it is stopped.
- See Node configuration for `control` topic options to `cancel` the timer.

## Outputs
The node contains two outputs:
- The **primary output** (upper output) emits an output `msg` at the **countdown start/stop** instant of time. These `msg.payload` contents are configurable.
- The **secondary output** (lower output) emits the **remaining time every second** (or every 100ms if high precision is enabled) during the timer run.

The output format for the time display is standardized to be user-friendly regardless of the configured time unit:
- Less than 60 seconds: shown in seconds (e.g., "45s")
- Between 60 seconds and 60 minutes: shown as minutes and seconds (e.g., "2m 30s")
- More than 60 minutes: shown as hours, minutes, seconds (e.g., "1h 15m 30s")

When high precision mode is enabled, seconds are shown with one decimal place only when less than a minute remains (e.g., "10.5s"). For longer durations, seconds are still displayed as whole numbers (e.g., "2m 30s" or "1h 15m 30s").


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


### Visualizer for trigger delay time
This example shows how one can add a countdown node that takes the same input as a trigger and then can visually show you its time left.
![Alt text](images/flow-trigger-visualizer.png?raw=true "Flow Trigger Visualizer")
