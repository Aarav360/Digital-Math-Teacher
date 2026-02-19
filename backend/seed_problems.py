"""Seed the problems table with sample math problems."""
import asyncio
from sqlalchemy import select
from app.db.session import async_session_factory
from app.models.problem import Problem

PROBLEMS = [
    {"id": "1", "title": "Solve for x: 2x + 5 = 13", "topic": "Algebra 1", "difficulty": 1, "type": "Equations", "estimated_time": "5 min", "statement": "Solve for x:\n2x + 5 = 13"},
    {"id": "2", "title": "Factor: x² - 5x + 6", "topic": "Algebra 1", "difficulty": 2, "type": "Equations", "estimated_time": "8 min", "statement": "Factor the following expression:\nx² - 5x + 6"},
    {"id": "3", "title": "Find the derivative of f(x) = 3x³ - 2x + 1", "topic": "Calc 1", "difficulty": 3, "type": "Equations", "estimated_time": "10 min", "statement": "Find the derivative of:\nf(x) = 3x³ - 2x + 1"},
    {"id": "4", "title": "Evaluate: ∫(2x + 1)dx from 0 to 3", "topic": "Calc 1", "difficulty": 3, "type": "Equations", "estimated_time": "12 min", "statement": "Evaluate the definite integral:\n∫₀³ (2x + 1) dx"},
    {"id": "5", "title": "Solve the system: x + y = 7, 2x - y = 2", "topic": "Algebra 2", "difficulty": 2, "type": "Equations", "estimated_time": "10 min", "statement": "Solve the system of equations:\nx + y = 7\n2x - y = 2"},
    {"id": "6", "title": "Prove: sin²θ + cos²θ = 1", "topic": "Trig", "difficulty": 3, "type": "Proof/Reasoning", "estimated_time": "15 min", "statement": "Prove the Pythagorean identity:\nsin²θ + cos²θ = 1"},
    {"id": "7", "title": "Find eigenvalues of [[2,1],[1,2]]", "topic": "Linear Algebra", "difficulty": 4, "type": "Equations", "estimated_time": "20 min", "statement": "Find the eigenvalues of the matrix:\nA = [[2, 1], [1, 2]]"},
    {"id": "8", "title": "Find the area between y = x² and y = x", "topic": "Calc 1", "difficulty": 3, "type": "Word Problems", "estimated_time": "15 min", "statement": "Find the area of the region bounded by:\ny = x² and y = x"},
    {"id": "9", "title": "Simplify: (3x²y³)² / (9xy²)", "topic": "Algebra 1", "difficulty": 2, "type": "Equations", "estimated_time": "5 min", "statement": "Simplify the expression:\n(3x²y³)² / (9xy²)"},
    {"id": "10", "title": "Find the limit: lim(x→0) sin(x)/x", "topic": "Pre-Calc", "difficulty": 3, "type": "Equations", "estimated_time": "8 min", "statement": "Evaluate the limit:\nlim(x→0) sin(x)/x"},
]


async def seed():
    async with async_session_factory() as db:
        for p in PROBLEMS:
            existing = await db.execute(select(Problem).where(Problem.id == p["id"]))
            if existing.scalar_one_or_none() is None:
                db.add(Problem(**p))
                print(f"  Added: {p['title']}")
            else:
                print(f"  Exists: {p['title']}")
        await db.commit()
    print("Done seeding problems.")


if __name__ == "__main__":
    asyncio.run(seed())
