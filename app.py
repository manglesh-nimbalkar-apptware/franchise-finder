from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use import Agent, Controller, BrowserConfig, Browser
from dotenv import load_dotenv
import os
import json
import re
import asyncio

load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", '')
gemini_api_key = os.getenv('GOOGLE_API_KEY', '')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FranchiseQuery(BaseModel):
    franchise_name: str
    country: str
    state: str
    city: str

class Location(BaseModel):
    address: str
    phone: str
    source: str

class Locations(BaseModel):
    locations: List[Location]

planner_llm = ChatOpenAI(model='o4-mini')

browser_config = BrowserConfig(
    headless=False, 
    disable_security=True,

    # browser_binary_path='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    # browser_binary_path="C:\Program Files\Google\Chrome\Application\chrome.exe",
)

google_maps_browser = Browser(config=browser_config)
official_website_browser = Browser(config=browser_config)

async def stream_franchise_details(franchise_name: str, country: str, state: str, city: str):
    shared_locations = set()
    active_agents = 0
    
    try:
        yield f"data: {json.dumps({'status': 'initializing', 'message': 'Starting search on multiple sources...'})}\n\n"
        
        result_queue = asyncio.Queue()
        
        async def process_agent_results(agent, source_name, queue):
            nonlocal active_agents
            
            await queue.put(f"data: {json.dumps({'status': 'progress', 'source': source_name, 'message': f'Searching {source_name}...'})}\n\n")
            
            try:
                # NOTE: Removed active_agents increment here because we set it based on task count
                print(f"Starting search with {source_name} agent")
                
                controller = Controller(output_model=Locations)
                agent.controller = controller
                
                result = await agent.run(max_steps=10)
                
                final_data = result.final_result()
                print(f"Final data from {source_name}: {final_data}")
                
                if isinstance(final_data, str):
                    try:
                        if final_data.strip().startswith("{"):
                            parsed_data = json.loads(final_data)
                            
                            if "locations" in parsed_data and isinstance(parsed_data["locations"], list):
                                for loc in parsed_data["locations"]:
                                    location = {
                                        "Address": loc.get("address", ""),
                                        "Phone": loc.get("phone", ""),
                                        "Source": loc.get("source", source_name)
                                    }
                                    
                                    loc_id = f"{location['Address']}|{location['Phone']}"
                                    if loc_id not in shared_locations:
                                        shared_locations.add(loc_id)
                                        await queue.put(f"data: {json.dumps({'location': location, 'source': source_name})}\n\n")
                        else:
                            locations = []
                            for line in final_data.split("\n"):
                                if '"address"' in line.lower() and '"phone"' in line.lower():
                                    try:
                                        loc = json.loads(line)
                                        location = {
                                            "Address": loc.get("address", loc.get("Address", "")),
                                            "Phone": loc.get("phone", loc.get("Phone", "")),
                                            "Source": loc.get("source", loc.get("Source", source_name))
                                        }
                                        
                                        loc_id = f"{location['Address']}|{location['Phone']}"
                                        if loc_id not in shared_locations:
                                            shared_locations.add(loc_id)
                                            await queue.put(f"data: {json.dumps({'location': location, 'source': source_name})}\n\n")
                                    except:
                                        pass
                    except Exception as e:
                        print(f"Error parsing final data: {e}")
                
                await queue.put(f"data: {json.dumps({'status': 'complete', 'source': source_name})}\n\n")
                active_agents -= 1
                print(f"{source_name} agent completed, remaining agents: {active_agents}")
                
            except Exception as e:
                error_msg = str(e)
                print(f"{source_name} agent error: {error_msg}")
                await queue.put(f"data: {json.dumps({'status': 'error', 'source': source_name, 'message': error_msg})}\n\n")
                await queue.put(f"data: {json.dumps({'status': 'complete', 'source': source_name})}\n\n")
                active_agents -= 1
                print(f"{source_name} agent failed, remaining agents: {active_agents}")
        
        # Create agents with separate browsers and improved retry logic
        def create_agent(task, url, source_name, browser):
            try:
                return Agent(
                    task=task,
                    llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash-lite", api_key=gemini_api_key),
                    initial_actions=[{'open_tab': {'url': url}}],
                    use_vision=False,
                    enable_memory=False,
                    # planner_llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=gemini_api_key),
                    # planner_interval=4,
                    # controller_kwargs={"browser_id": f"{source_name}_{franchise_name}_{city}"},
                    browser=browser,
                )
            except Exception as e:
                print(f"Error creating {source_name} agent: {str(e)}")
                return None

        google_maps_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} using Google Maps only. The google maps tab is already opened for you you just need to search."
                f"For each location, extract the exact address and phone number. Return all the different locations from the results in side pane. Do not deep dive any further."
                f"Return each location in JSON format: {{\"address\": \"<address>\", \"phone\": \"<phone>\", \"source\": \"Google Maps\"}}"
            ),
            url=f'https://www.google.com/maps/search/{franchise_name}+{city}+{state}+{country}',
            source_name="Google Maps",
            browser=google_maps_browser,
        )
        
        official_website_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {state}, {country} by visiting the official website only. "
                f"For each location, extract the exact address and phone number."
                f"Return each location in JSON format: {{\"address\": \"<address>\", \"phone\": \"<phone>\", \"source\": \"Official Website\"}}"
                f"Do not stop until and unless you have completely verified that no more locations from the official website can be found."
            ),
            url=f"https://www.bing.com/search?q={franchise_name}+official+website+{city}+{state}+{country}",
            source_name="Official Website",
            browser=official_website_browser,
        )
        
        tasks = [
            *([asyncio.create_task(process_agent_results(google_maps_agent, "Google Maps", result_queue))] if google_maps_agent else []),
            *([asyncio.create_task(process_agent_results(official_website_agent, "Official Website", result_queue))] if official_website_agent else [])
        ]
        
        # Set the initial count of active agents
        active_agents = len(tasks)
        print(f"Starting with {active_agents} active agents")
        
        if active_agents == 0:
            yield f"data: {json.dumps({'error': 'Failed to create any search agents'})}\n\n"
            return

        results_sent = False
        while active_agents > 0 or not result_queue.empty():
            try:
                message = await asyncio.wait_for(result_queue.get(), timeout=1.0)
                if '"location":' in message:
                    results_sent = True
                yield message
            except asyncio.TimeoutError:
                # Add a status check every few timeouts
                # print(f"Waiting for results... Active agents: {active_agents}, Queue empty: {result_queue.empty()}")
                continue
        
        if len(shared_locations) == 0 and not results_sent:
            fallback_loc = {
                "Address": f"No specific {franchise_name} locations found in {city}, {state}, {country}",
                "Phone": "N/A",
                "Source": "System"
            }
            yield f"data: {json.dumps({'location': fallback_loc, 'source': 'System'})}\n\n"
        
        print("Stream complete, all agents finished, sending all_complete signal")
        yield f"data: {json.dumps({'status': 'all_complete'})}\n\n"
        
    except Exception as e:
        error_msg = str(e)
        print(f"Streaming error: {error_msg}")
        yield f"data: {json.dumps({'error': error_msg})}\n\n"

@app.post("/get-franchise-details-stream")
async def stream_franchise_details_endpoint(query: FranchiseQuery):
    return StreamingResponse(
        stream_franchise_details(
            query.franchise_name,
            query.country,
            query.state,
            query.city
        ),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)