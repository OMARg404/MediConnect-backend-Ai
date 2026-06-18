import asyncio

import httpx


BASE_URL = "http://localhost:8000"


async def main() -> None:
    print("=== Medical AI Assistant Test ===")

    question = input("Enter patient question (Arabic or English): ").strip()
    if not question:
        print("No question provided, exiting.")
        return

    # You can change these to your actual test coordinates
    latitude = 30.0444
    longitude = 31.2357

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1) Start diagnosis
        print("\n[1] Calling /ai/diagnosis/start ...")
        start_resp = await client.post(
            "/ai/diagnosis/start",
            json={
                "question": question,
                "latitude": latitude,
                "longitude": longitude,
            },
        )
        start_resp.raise_for_status()
        start_data = start_resp.json()

        session_id = start_data["session_id"]
        next_question = start_data["next_question"]
        print(f"Session ID: {session_id}")
        print(f"AI Question: {next_question}")

        # 2) Loop through follow-up questions
        need_more = start_data["need_more_questions"]

        final_diagnosis = None
        sub_type = None

        step = start_data["current_step"]

        while need_more:
            answer = input("\nYour answer: ").strip()
            print(f"[2] Calling /ai/diagnosis/continue (step {step + 1}) ...")

            cont_resp = await client.post(
                "/ai/diagnosis/continue",
                json={
                    "session_id": session_id,
                    "answer": answer,
                },
            )
            cont_resp.raise_for_status()
            cont_data = cont_resp.json()

            need_more = cont_data["need_more_questions"]
            step = cont_data["current_step"]

            if need_more:
                next_question = cont_data["next_question"]
                print(f"\nAI Question ({step}/{cont_data['max_steps']}): {next_question}")
            else:
                final_diagnosis = cont_data.get("final_diagnosis")
                sub_type = cont_data.get("subType")
                print("\n=== Final diagnosis from AI ===")
                print(f"Diagnosis: {final_diagnosis}")
                print(f"subType:   {sub_type}")

        # 3) Finalize and get nearest place
        print("\n[3] Calling /ai/diagnosis/finalize ...")
        fin_resp = await client.post(
            "/ai/diagnosis/finalize",
            json={"session_id": session_id},
        )
        fin_resp.raise_for_status()
        fin_data = fin_resp.json()

        print("\n=== Final response with nearest place ===")
        print(f"Diagnosis: {fin_data['diagnosis']}")
        print(f"subType:   {fin_data['subType']}")

        place = fin_data.get("nearest_place")
        if place:
            print("\nNearest place:")
            print(f"  Name:        {place.get('name') or place.get('displayName')}")
            print(f"  Address:     {place.get('fullAddress') or place.get('listingAddress')}")
            phones = place.get("phoneNumbers") or []
            if phones:
                print(f"  Phone(s):    {', '.join(phones)}")
            print(f"  Detail URL:  {place.get('detailUrl')}")
        else:
            print("\nNo nearby place found for this subType/coordinates.")


if __name__ == "__main__":
    asyncio.run(main())

