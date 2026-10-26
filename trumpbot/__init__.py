"""TrumpBot: one president, one Grok director, twelve agents, four rooms.

Original fictional parody. Not an official White House system and not affiliated
with xAI, Grok or any real person's office.
"""

from .core import Agent, Director, Event, Run, Task, camera_x, camera_zoom, simulate
from .west_wing import AGENTS, ROOMS, SCRIPT

__all__ = ["Agent", "Director", "Event", "Run", "Task", "camera_x", "camera_zoom", "simulate",
           "AGENTS", "ROOMS", "SCRIPT"]
__version__ = "1.0.0"
