// Chapter 1 — Market Street. Compiled at build time (build/ink.ts) and run with inkjs.
// Lines are "SPEAKER: text". Variables feed squad relationships (rpg: meaningful choices).
VAR trust_iris = 0
VAR trust_miller = 0
VAR has_fuse = false
VAR spared = false

=== intro ===
IRIS: Ninety seconds. It repeats every ninety seconds. Same coordinates, same voice.
REED: Could be a recording from the first week. Could be bait.
MILLER: Could be someone with a working generator and a sense of humour.
IRIS: Relay 7 is at the end of Market Street. If we boost it, I can lock the source.
* [We go. Quietly.]
    ~ trust_iris += 1
    REED: We go. Quietly. Stay low in the dark, and nobody fires unless they have to.
* [We go, but we scavenge on the way.]
    ~ trust_miller += 1
    REED: We go. But we fill our packs on the way — no point reaching a signal hungry.
- MAYA: Then stop talking. The rain only covers so much.
-> END

=== first_infected ===
MAYA: One of them. Up ahead, facing away.
REED: Crouch, come up behind it, and put it down quick. A shot here wakes the whole street.
-> END

=== pharmacy ===
MAYA: The pharmacy. If there's a single bandage left on this street, it's in there.
IRIS: Two of them sleeping inside the light. Toss a bottle across the road — they'll go look.
-> END

=== garage ===
MILLER: My kind of place. There's a workbench in the back.
MILLER: Bring me scrap, a battery and tape, and I'll make you a fuse the relay will take.
-> END

=== overpass ===
IRIS: The band is screaming. There are a lot of them under that bridge.
* [We sneak through.]
    ~ trust_iris += 1
    REED: Single file, crouched. Nobody fires.
* [We clear it.]
    ~ trust_miller += 1
    MILLER: Then we do it loud and we do it once.
- -> END

=== breather ===
MAYA: Hold up. Breathe. Check your bandages.
MILLER: Relay's just past the fence. Something big was moving there.
-> END

=== relay_approach ===
IRIS: That's it. Relay 7. And that — that's not a person anymore.
-> END

=== relay_locked ===
MILLER: The fuse is blown. We need a new one — workbench, scrap, battery, tape.
-> END

=== relay_restore ===
IRIS: Fuse in. Power's coming up... come on...
RADIO: ...emergency protocol seven... coordinates follow... if you can hear this, you are not alone...
IRIS: It's live. It's a person. Someone is reading that message right now.
{ trust_iris > trust_miller:
    REED: Then we keep going. Together.
- else:
    MILLER: Let's hope they're friendlier than everything else out here.
}
* [Answer the transmission.]
    IRIS: This is Iris, Market Street, four survivors. We hear you. We're coming.
* [Stay silent for now.]
    REED: Not yet. We find out who they are before they find out who we are.
- RADIO: ...repeat... north-east facility... ninety seconds...
-> END
