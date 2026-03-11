"""Seed the problems table with sample math problems."""
import asyncio

from app.services.sample_problems import seed_sample_problems


async def seed():
    missing = await seed_sample_problems()
    if not missing:
        print("Sample problems already present.")
    else:
        for problem in missing:
            print(f"  Added: {problem['title']}")
    print("Done seeding problems.")


if __name__ == "__main__":
    asyncio.run(seed())
