"""The orchestration rules.

A Director (Grok) receives the feed for each room, drops duplicates, hands every
task to exactly one agent with the right role, and holds anything that needs the
president's own decision. Time is simulated, so a run is deterministic per seed.
"""
from __future__ import annotations

import random
from dataclasses import asdict, dataclass, field

from .west_wing import AGENTS, KIND_TO_ROLE, ROOM_SECONDS, ROOMS, RUN_SECONDS, SCRIPT, WALK_SECONDS, Room

HOME_BONUS = 1.5     # seconds of waiting the director accepts to keep work in the room
WORK_RANGE = (1.8, 3.4)
DEDUPE_SECONDS = 0.6


@dataclass
class Task:
    id: int
    room: str
    kind: str
    title: str
    sources: int
    needs_president: bool
    owner: str | None = None
    status: str = "queued"          # queued -> running -> done | held
    t_start: float | None = None
    t_end: float | None = None


@dataclass
class Agent:
    key: str
    role: str
    department: str
    home: str
    free_at: float = 0.0
    shifts: list[tuple[float, float, int]] = field(default_factory=list)  # (start, end, task id)


@dataclass
class Event:
    t: float
    agent: str
    text: str
    room: str

    def line(self) -> str:
        return f"{int(self.t):02d} {self.agent.upper()} / {self.text}"


@dataclass
class Run:
    seed: int
    events: list[Event]
    tasks: list[Task]
    agents: list[Agent]
    duplicates: list[str]

    @property
    def done(self) -> list[Task]:
        return [t for t in self.tasks if t.status == "done"]

    @property
    def held(self) -> list[Task]:
        return [t for t in self.tasks if t.status == "held"]

    def done_by(self, t: float) -> int:
        return sum(1 for x in self.done if x.t_end is not None and x.t_end <= t)

    def summary(self) -> dict[str, int]:
        return {
            "tasks": len(self.tasks),
            "done": len(self.done),
            "held": len(self.held),
            "duplicates": len(self.duplicates),
            "source_links": sum(t.sources for t in self.tasks),
            "rooms": len(ROOMS),
            "agents": len(self.agents),
            "cuts": 0,
        }

    def to_dict(self) -> dict:
        return {
            "seed": self.seed,
            "run_seconds": RUN_SECONDS,
            "room_seconds": ROOM_SECONDS,
            "walk_seconds": WALK_SECONDS,
            "rooms": [{**asdict(r), "start": r.start, "end": r.end} for r in ROOMS],
            "agents": [{k: v for k, v in asdict(a).items() if k != "free_at"} for a in self.agents],
            "tasks": [asdict(t) for t in self.tasks],
            "events": [{**asdict(e), "line": e.line()} for e in self.events],
            "duplicates": self.duplicates,
            "summary": self.summary(),
        }


def smoothstep(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def room_at(t: float) -> Room:
    i = min(len(ROOMS) - 1, max(0, int(t // ROOM_SECONDS)))
    return ROOMS[i]


def camera_x(t: float) -> float:
    """One continuous camera: it follows the president and never cuts."""
    room = room_at(t)
    if room.index == 0:
        return room.center_x
    prev = ROOMS[room.index - 1].center_x
    return prev + (room.center_x - prev) * smoothstep((t - room.start) / WALK_SECONDS)


def camera_zoom(t: float) -> float:
    """0.90 for the run, then a slow pull-back over the last four seconds."""
    return 0.90 - 0.18 * smoothstep((t - (RUN_SECONDS - 4)) / 4)


class Director:
    def __init__(self, seed: int = 47):
        self.rng = random.Random(seed)
        self.seed = seed
        self.agents = [Agent(*row) for row in AGENTS]
        self.events: list[Event] = []
        self.tasks: list[Task] = []
        self.duplicates: list[str] = []

    def log(self, t: float, agent: str, text: str, room: str) -> None:
        self.events.append(Event(round(t, 2), agent, text, room))

    def route(self, kind: str, room: str, now: float) -> Agent:
        """Right role only. Prefer the room's own agent unless it would wait too long,
        then whoever has done the least so far."""
        role = KIND_TO_ROLE[kind]
        pool = [a for a in self.agents if a.role == role]
        return min(pool, key=lambda a: (max(a.free_at, now) + (0 if a.home == room else HOME_BONUS),
                                        len(a.shifts), a.key))

    def book(self, agent: Agent, now: float, seconds: float, task_id: int) -> tuple[float, float]:
        start = max(now, agent.free_at)
        end = round(start + seconds, 2)
        agent.free_at = end
        agent.shifts.append((round(start, 2), end, task_id))
        return round(start, 2), end

    def run(self, script=SCRIPT) -> Run:
        seen: set[str] = set()
        for room in ROOMS:
            if room.index == 0:
                self.log(0.0, "director", "initialize West Wing", room.key)
                arrive = 0.5
            else:
                self.log(room.start, "director", f"route president -> {room.name}", room.key)
                arrive = room.start + WALK_SECONDS
            self.log(arrive, "potus", room.line, room.key)

            feed = [row for row in script if row[0] == room.key]
            for k, (_, kind, title, sources, needs_president) in enumerate(feed):
                t_in = arrive + 0.6 + k * 1.4
                if title in seen:
                    checker = self.route("check", room.key, t_in)
                    start, _ = self.book(checker, t_in, DEDUPE_SECONDS, -1)
                    self.log(start, checker.key, f"flag a duplicate: {title}", room.key)
                    self.duplicates.append(title)
                    continue
                seen.add(title)

                task = Task(len(self.tasks) + 1, room.key, kind, title, sources, needs_president)
                agent = self.route(kind, room.key, t_in)
                task.owner = agent.key
                task.t_start, task.t_end = self.book(agent, t_in, self.rng.uniform(*WORK_RANGE), task.id)
                task.status = "held" if needs_president else "done"
                self.tasks.append(task)

                self.log(task.t_start, agent.key, title, room.key)
                if needs_president:
                    self.log(task.t_end, "director", f"hold: {title} waits for POTUS", room.key)
                else:
                    self.log(task.t_end, agent.key, f"done #{task.id:02d} ({sources} source{'s' if sources != 1 else ''})", room.key)

        self.events.sort(key=lambda e: e.t)
        return Run(self.seed, self.events, self.tasks, self.agents, self.duplicates)


def simulate(seed: int = 47) -> Run:
    return Director(seed).run()
