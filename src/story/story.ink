// The Last Frequency — the whole campaign in one Ink story (compiled at build time by build/ink.ts).
// Lines are "SPEAKER: text"; a line without a speaker is narration. Knots named bark_* play as
// subtitles while you keep moving; every other knot is a conversation the world waits for.
// Variables carry across chapters in the save: trust drives who opens up, and — with the three
// research notes the game counts into `research` — whether the last choice has a third answer.
VAR trust_iris = 0
VAR trust_miller = 0
VAR trust_maya = 0
VAR reed_told = false
VAR iris_told = false
VAR research = 0
VAR ending = 0

// ============================================================ CHAPTER 1 — MARKET STREET
=== intro ===
IRIS: Ninety seconds. It repeats every ninety seconds. Same coordinates, same voice.
REED: Could be a recording from the first week. Could be bait.
MILLER: Could be somebody with a working generator and a sense of humour.
IRIS: It isn't a recording. She breathes in different places every time.
MAYA: She?
IRIS: Relay 7 is at the end of Market Street. If we wake it up, I can lock the source.
* [We go. Quietly.]
    ~ trust_iris += 1
    REED: We go. Low, in the dark, and nobody fires unless they have to.
    IRIS: Thank you.
* [We go — and we fill our packs on the way.]
    ~ trust_miller += 1
    REED: We go. But we search every door between here and there. No sense reaching a signal hungry.
    MILLER: Now you're talking.
- MAYA: Then stop talking. The rain only covers so much.
-> END

=== bark_first_infected ===
MAYA: One of them. Up ahead, facing away.
REED: Crouch, come up behind it, put it down quick. A shot here wakes the whole street.
-> END

=== bark_pharmacy ===
MAYA: The pharmacy. If there's one bandage left on this street, it's in there.
IRIS: I can hear them through the wall. Go in quiet.
-> END

=== bark_garage ===
MILLER: My kind of place. Workbench is still standing.
MILLER: Scrap, a battery and tape — I'll make you a fuse the relay will take.
-> END

=== overpass ===
IRIS: The band is screaming. There are a lot of them under that bridge.
MILLER: One of those thin ones too. The kind that calls the rest.
* [Single file. Nobody fires.]
    ~ trust_iris += 1
    REED: Crouched, single file. If the screamer sees us, it dies first.
* [We clear it. Loud and once.]
    ~ trust_miller += 1
    MILLER: Then we do it loud and we do it once.
- -> END

=== bark_breather ===
MAYA: Hold up. Breathe. Check your bandages.
MILLER: Relay's just past the fence. Something big is moving there.
-> END

=== bark_relay_approach ===
IRIS: That's it. Relay 7. And that — that's not a person anymore.
-> END

=== relay_locked ===
MILLER: Fuse is blown. We need a new one — workbench, scrap, battery, tape.
-> END

=== relay_restore ===
IRIS: Fuse in. Power's coming up... come on...
RADIO: ...protocol lighthouse... resistant carriers, report to the coordinates... if you can hear this, you are not alone...
IRIS: It's live. Listen — she coughed. Somebody is reading that into a microphone right now.
MAYA: "Resistant carriers." What does that mean, resistant?
REED: Means some people don't turn.
MILLER: Says who?
REED: ...Says the radio.
* [Answer the transmission.]
    ~ trust_iris += 1
    IRIS: This is Iris, Market Street, four survivors. We hear you. We're coming.
    RADIO: ...
    IRIS: She stopped reading. She heard me.
* [Stay silent for now.]
    ~ trust_miller += 1
    REED: Not yet. We find out who they are before they find out who we are.
    IRIS: She's alone, Reed. I can hear it.
- RADIO: ...north-east. Genova. Please... this message repeats.
-> END

// ============================================================ SAFEHOUSE 1 — THE KEEPER'S FLAT
=== camp1_arrive ===
MAYA: The relay keeper lived up here. He left candles. He left books.
MILLER: He left a door that locks. First one in a month.
IRIS: North-east is the highway. A day's walk, if the fog holds.
REED: Then we sleep. Talk to me if you need to. We leave at first light.
-> END

=== camp1_maya ===
MAYA: I keep a list. You've seen me writing.
REED: I thought it was supplies.
MAYA: Names. Everyone I couldn't keep alive. Forty-one. I was a second-year student, Reed. They gave me a ward.
* [You kept the rest of us alive.]
    ~ trust_maya += 1
    REED: There's a second list. People still breathing because of you. I'm on it. Twice.
    MAYA: ...Three times. You forget the roof.
* [Stop writing it.]
    REED: Then stop adding to it. It doesn't help them.
    MAYA: It isn't for them.
- MAYA: Something else. That prescription pad in the pharmacy — "Genova, trial batch seven." I gave out those boxes. Before.
MAYA: If the voice is at Genova, I want to know what I handed people.
-> END

=== camp1_miller ===
MILLER: Thirty years in that garage. You know what I think about? An ambulance. Number twelve. Brakes.
REED: The one nobody collected.
MILLER: My girl drove it. Dana. She took the route seven bus out to Lighthouse Point the day they closed the roads, and I stayed to finish a brake job.
* [Then she got out. That's a good thing.]
    ~ trust_miller += 1
    REED: She was ahead of it, Miller. People who left that day had a chance.
    MILLER: That's what I tell the engines.
* [We can't go looking for one person.]
    REED: I can't promise we'll look.
    MILLER: Didn't ask you to. Just wanted somebody else to know her name.
- MILLER: Bring me scrap and I'll make these guns hit harder. It's the only thing I'm still good for.
-> END

=== camp1_iris ===
IRIS: Can I tell you something and you don't tell the others?
REED: Depends.
IRIS: The voice. I've been recording it for nine days. It isn't a soldier. It isn't a doctor. It's a kid, Reed. Trying to sound grown.
* [Then we get there faster.]
    ~ trust_iris += 1
    REED: Then she's been alone nine days at least. We go faster.
    IRIS: I knew you'd say that. I hoped.
* [A kid can be bait too.]
    REED: Kids can be made to read things.
    IRIS: ...Yeah. I thought of that. I didn't want to.
- IRIS: "Resistant carriers." You went very quiet when she said that.
REED: Get some sleep, Iris.
-> END

// ============================================================ CHAPTER 2 — THE LONG ROAD
=== road_start ===
MILLER: Can't see a hundred metres.
IRIS: Neither can they. Listen — they're out there, standing in it.
MAYA: Then we walk. Nobody runs unless it's already gone wrong.
REED: Highway runs to the quarantine line. Gate'll be shut. We'll need to open it.
-> END

=== bark_diner ===
MILLER: Diner. Lights are still on somehow.
MAYA: Lights mean a generator. A generator means fuel.
-> END

=== bark_gas ===
REED: Gas station. If there's a full can left anywhere on this road, it's in there.
-> END

=== bark_motel ===
IRIS: Somebody's been living in that motel. Blankets in the window.
-> END

=== pileup ===
IRIS: Stop. Stop. The whole road's full of them — they're standing between the cars.
MAYA: There's a screamer on the bus roof. If it starts, they all come.
* [Bottles. Pull them off the road.]
    ~ trust_maya += 1
    REED: Throw long, into the trees. We walk through behind them.
* [Screamer first, then the rest.]
    ~ trust_miller += 1
    MILLER: Give me the first shot. It won't get a second breath.
- -> END

=== bark_checkpoint ===
MAYA: The quarantine line. They were turning people back here.
MILLER: Somebody's still on duty.
-> END

=== gate_locked ===
MILLER: Gate motor's dry. It wants fuel — a full can.
MAYA: The gas station back down the road. There was a jerrycan by the pumps.
-> END

=== gate_guarded ===
REED: Not with that thing walking the line.
-> END

=== gate_open ===
MILLER: There. She's turning over.
MAYA: Reed. The trooper's log. Read the list.
REED: "Passed through, day three, no symptoms. Dana Miller, ambulance twelve."
MILLER: ...
MILLER: Day three. She was driving. She was driving.
IRIS: The road past the gate goes one place. Genova.
-> END

// ============================================================ SAFEHOUSE 2 — THE BARRACKS
=== camp2_arrive ===
MAYA: Barracks. Bunks, a stove. Somebody hung plants in the window before the end.
IRIS: The signal is close now. I don't need the headphones.
REED: One more sleep. Then we see who's been calling.
-> END

=== camp2_maya ===
MAYA: Sit. I'm changing that dressing.
MAYA: You were bitten on the overpass. I saw it. That was six days ago.
MAYA: Six days, no fever, no tremor. I've buried people at day two.
* [I'm resistant. I've known since the first week.]
    ~ reed_told = true
    ~ trust_maya += 1
    REED: It took my brother in a night and it did nothing to me. I didn't know how to say it without it sounding like I'd been spared on purpose.
    MAYA: You should have told me. I'd have stopped wasting bandages on you.
    MAYA: ...I'm glad. Don't tell Miller I said so.
* [Lucky, I guess.]
    REED: Lucky. Thick skin.
    MAYA: I'm a nurse, Reed. Not an idiot. When you're ready.
- MAYA: Whatever Genova wants with people like you, I'm in the room when they ask.
-> END

=== camp2_miller ===
MILLER: Day three, no symptoms. I've read that line forty times.
MILLER: I spent a month thinking I'd fixed brakes while my daughter died. She was driving the damn thing.
* [She'd be proud you kept the keys.]
    ~ trust_miller += 1
    REED: You kept her keys on that work order. Somebody will need it, you wrote.
    MILLER: Somebody did.
* [Don't hope too hard.]
    REED: That was a long time ago, Miller.
    MILLER: I know what day it is.
- MILLER: Whatever's at the end of this, I'm walking back out of it. I've got somewhere to be.
-> END

=== camp2_iris ===
IRIS: I worked out why she says "carriers."
{ trust_iris >= 2: -> camp2_iris_tell }
IRIS: It means people who can carry it and not turn. That's who she wants.
IRIS: I wonder what she wants them for.
REED: Tomorrow we ask her.
-> END

=== camp2_iris_tell ===
IRIS: I got sick in the first week. Properly sick. Then I got better, and after that I could hear them. On the band. In my teeth.
IRIS: I'm one of them, Reed. One of the ones she's calling. I think you are too.
~ iris_told = true
* [Then she's calling both of us.]
    ~ trust_iris += 1
    REED: Then we're the reason this walk is worth anything. Both of us.
    IRIS: Both of us. I like that better than "just me."
* [Keep that between us for now.]
    REED: Don't tell the others yet.
    IRIS: I already told Maya. She said she knew.
- -> END

// ============================================================ CHAPTER 3 — GENOVA LABS
=== labs_start ===
IRIS: There. The mast. That's where she is.
MAYA: Genova Labs. My whole second year smelled like their packaging.
MILLER: Fence is down. That's either good news or the worst news.
REED: Stay together. We go in the front.
-> END

=== bark_lot ===
MAYA: Staff car park. They never left work.
-> END

=== lab_enter ===
MAYA: Emergency power. Tanks are still running.
IRIS: She's at the end of this hall. Behind that door. The signal's so strong it hurts.
MILLER: And between us and the door?
REED: Read everything. Whoever wrote this place down wanted it understood.
-> END

=== bark_host ===
IRIS: It isn't moving. It's just standing at her door.
MAYA: It's wearing a lab coat.
-> END

=== door_guarded ===
REED: It won't let us past. It isn't hunting. It's guarding.
-> END

=== finale ===
The door opens on a small room: a microphone, a cot, a wall of drawings.
WREN: You're real. I counted the days. Four hundred and six. Mum said somebody would come if I kept reading.
MAYA: Sweetheart. Where's your mum?
WREN: She got sick making the medicine. She told me to lock the door and never open it for her. She stands outside. She never tried the handle. Not once.
MILLER: ...The one in the coat.
IRIS: Wren. I'm Iris. I answered you, on the first night. Did you hear me?
WREN: I heard. I didn't know what you're supposed to say back.
MAYA: Her mother's journal. The machine is ready. It needs blood from someone the sickness can't take — more than a body can give.
{ research >= 3 and (reed_told or iris_told):
    MAYA: Wait. The motel register. The pad. Her last entry — "two carriers, half the draw each." She never had two.
    IRIS: She has two now.
}
REED: Then it's simple. What do we do with it?
* [One donor. Me. Make the serum.]
    ~ ending = 1
    REED: It takes one. I've been walking around with it in me since the first week, doing nothing with it.
    MAYA: Reed, it will stop your heart.
    REED: Then keep the list short, Maya. Just the one more.
* [Shut it down. Nobody else walks here to die.]
    ~ ending = 2
    REED: No. Nobody gets on that table. We switch the broadcast off so no one else follows it here, and we take the girl out.
    IRIS: And the cure?
    REED: Somebody smarter than us finds another way. Not this one.
* { research >= 3 and (reed_told or iris_told) } [Two donors. Half each. Nobody dies.]
    ~ ending = 3
    REED: Two carriers. Half each. Iris — you don't have to.
    IRIS: I walked the whole way here hoping it was for something.
    MAYA: Twelve hours apart. I do the draw. I am not adding either of you to my list.
- -> END
