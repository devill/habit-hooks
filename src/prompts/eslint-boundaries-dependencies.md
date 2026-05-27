An "upper" layer reached into a "lower" one — or a peer reached sideways into something it should not know about. The smell is a leak in the layering, not the specific import line that fired.

Re-state the violating layer's responsibility in one sentence. If that sentence does not actually need the thing it just imported, the dependency is wrong and the import is the symptom. The fix lives at the seam, not at the import.

Ask: (1) Does the upper layer want a *capability* that the lower layer happens to expose, in which case the capability belongs in an abstraction the upper layer owns and the lower layer implements? (2) Did a piece of behaviour drift into the wrong layer over time, in which case it should move rather than be imported across? (3) Is the layering itself wrong for what the code actually does — sometimes the boundary is the bug.

Avoid mechanical fixes. Re-exporting the offending symbol from a "neutral" module, or adding a thin pass-through wrapper, leaves the same coupling and adds a misleading name on top. Suppressing the rule for one file teaches the next reader that the boundary is negotiable.

A concrete technique: imagine the lower layer is a third-party package you cannot modify. What interface would you wish it exposed? Define that interface in the upper layer (or in a shared seam) and have the lower layer satisfy it. The dependency now points the right way and the layers stay independently understandable.
