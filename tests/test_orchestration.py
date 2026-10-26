from trumpbot import ROOMS, camera_x, camera_zoom, simulate
from trumpbot.west_wing import KIND_TO_ROLE, RUN_SECONDS


def test_eighteen_tasks_sixteen_done_two_held():
    s = simulate().summary()
    assert (s["tasks"], s["done"], s["held"]) == (18, 16, 2)
    assert (s["rooms"], s["agents"], s["cuts"]) == (4, 12, 0)


def test_checker_catches_the_duplicate():
    run = simulate()
    assert run.duplicates == ["build the daily brief"]
    titles = [t.title for t in run.tasks]
    assert len(titles) == len(set(titles))
    assert any(e.agent == "checker" and e.text.startswith("flag a duplicate") for e in run.events)


def test_only_president_decisions_are_held():
    run = simulate()
    assert all(t.needs_president for t in run.held)
    assert all(not t.needs_president for t in run.done)


def test_every_task_has_one_owner_with_the_right_role():
    run = simulate()
    roles = {a.key: a.role for a in run.agents}
    for task in run.tasks:
        assert task.owner is not None
        assert roles[task.owner] == KIND_TO_ROLE[task.kind]
        assert task.sources >= 1


def test_an_agent_never_works_two_tasks_at_once():
    for agent in simulate().agents:
        shifts = sorted(agent.shifts)
        for (_, end, _), (start, _, _) in zip(shifts, shifts[1:]):
            assert start >= end


def test_everything_closes_inside_the_48_second_run():
    run = simulate()
    assert all(t.t_end < RUN_SECONDS for t in run.tasks)
    assert run.done_by(RUN_SECONDS) == 16


def test_continuous_camera_has_no_cuts():
    step = 1 / 30
    frames = [camera_x(i * step) for i in range(int(RUN_SECONDS * 30))]
    biggest = max(abs(b - a) for a, b in zip(frames, frames[1:]))
    assert biggest < 15  # a cut would jump ~750 world px in one frame
    assert camera_x(RUN_SECONDS - 0.01) == ROOMS[-1].center_x
    assert camera_zoom(0) == 0.9 and round(camera_zoom(RUN_SECONDS), 2) == 0.72


def test_president_visits_every_room_in_order():
    lines = [e.text for e in simulate().events if e.agent == "potus"]
    assert lines == [r.line for r in ROOMS]


def test_same_seed_same_run():
    assert simulate(7).to_dict() == simulate(7).to_dict()
