"""The fictional West Wing: four rooms, twelve agents, eighteen tasks.

Everything here is data. The rules that act on it live in core.py.
"""
from dataclasses import dataclass

RUN_SECONDS = 48.0
ROOM_SECONDS = 12.0
WALK_SECONDS = 3.0  # the president walks between rooms, the camera follows, nothing cuts


@dataclass(frozen=True)
class Room:
    index: int
    key: str
    name: str
    line: str          # what the president says on arrival
    center_x: float    # world x of the room centre (the camera tracks this)
    source: str        # the file this room writes into the source pipeline
    owner: str         # agent that owns the director queue while we are here

    @property
    def start(self) -> float:
        return self.index * ROOM_SECONDS

    @property
    def end(self) -> float:
        return self.start + ROOM_SECONDS


ROOMS = [
    Room(0, "oval", "Oval Office", "Grok. Bring me the brief.", 395, "BRIEF / 12 source-linked items", "director"),
    Room(1, "cabinet", "Cabinet Room", "Route the cabinet tasks.", 1145, "CABINET / task-board.json", "chief"),
    Room(2, "press", "Press Briefing", "Queue the press notes.", 1895, "PRESS / briefing-v03.md", "press"),
    Room(3, "ops", "Operations Center", "Show the operations board.", 2645, "AUDIT / run-timeline.log", "ops"),
]

# 12 agents, 4 roles x 3, 6 departments x 2. Home room decides who the director asks first.
#            key        role       department      home
AGENTS = [
    ("reader",  "reader",  "Briefing",     "oval"),
    ("brief",   "scribe",  "Briefing",     "oval"),
    ("checker", "checker", "Verification", "oval"),
    ("clerk",   "reader",  "Cabinet",      "cabinet"),
    ("chief",   "router",  "Cabinet",      "cabinet"),
    ("router",  "router",  "Routing",      "cabinet"),
    ("press",   "scribe",  "Press",        "press"),
    ("verify",  "checker", "Verification", "press"),
    ("scribe",  "scribe",  "Press",        "press"),
    ("ops",     "reader",  "Operations",   "ops"),
    ("audit",   "checker", "Operations",   "ops"),
    ("queue",   "router",  "Routing",      "ops"),
]

# What each task kind needs. The director only hands a task to an agent with this role.
KIND_TO_ROLE = {"read": "reader", "check": "checker", "route": "router", "draft": "scribe"}

# The incoming feed, in order. (room, kind, title, sources, needs_president)
# One line is a deliberate duplicate: the checker has to catch it.
SCRIPT = [
    ("oval",    "read",  "build the daily brief",          12, False),
    ("oval",    "check", "duplicate meeting slot",          2, False),
    ("oval",    "read",  "build the daily brief",          12, False),  # duplicate
    ("oval",    "draft", "assemble executive summary",      4, False),
    ("oval",    "route", "cabinet packet next",             3, False),
    ("oval",    "check", "sign-off: brief goes out",        1, True),
    ("cabinet", "route", "assign 6 department owners",      6, False),
    ("cabinet", "read",  "load cabinet task board",         5, False),
    ("cabinet", "check", "conflicting room booking",        2, False),
    ("cabinet", "draft", "cabinet minutes",                 3, False),
    ("cabinet", "route", "prepare press notes",             3, False),
    ("press",   "draft", "3 draft briefing cards",          3, False),
    ("press",   "check", "link source notes",               6, False),
    ("press",   "route", "prompt desk ready",               1, False),
    ("press",   "draft", "sign-off: statement v03",         2, True),
    ("ops",     "read",  "normalize feed clocks",           4, False),
    ("ops",     "check", "department acknowledgements",     6, False),
    ("ops",     "route", "live room status",                4, False),
    ("ops",     "draft", "write run-timeline.log",          2, False),
]
