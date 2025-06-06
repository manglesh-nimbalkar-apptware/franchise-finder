from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
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
# gemini_api_key = os.getenv('GEMINI_API_KEY_1', '')

# models = ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash", "gemini-2.0-flash-lite",]
# model = models[0]
# llms = {
#     "Google Maps": ChatGoogleGenerativeAI(model=model, api_key=os.getenv('GEMINI_API_KEY_1', gemini_api_key)),
#     "Official Website": ChatGoogleGenerativeAI(model=model, api_key=os.getenv('GEMINI_API_KEY_2', gemini_api_key)),
#     "Yelp": ChatGoogleGenerativeAI(model=model, api_key=os.getenv('GEMINI_API_KEY_3', gemini_api_key)),
#     "Yellow Pages": ChatGoogleGenerativeAI(model=model, api_key=os.getenv('GEMINI_API_KEY_4', gemini_api_key)),
#     "Other Websites": ChatGoogleGenerativeAI(model=model, api_key=os.getenv('GEMINI_API_KEY_5', gemini_api_key))
# }

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources (e.g., browser instances)
    global google_maps_browser, official_website_browser, yelp_browser, yellowpages_browser, random_website_browser
    print("Application startup: Initializing browser instances...")
    try:
        google_maps_browser = None
        official_website_browser = None
        yelp_browser = None
        yellowpages_browser = None
        random_website_browser = None

        print("Browser instances initialized.")
    except Exception as e:
        print(f"Error during browser initialization: {e}")

    yield  

    # Shutdown: Clean up resources
    print("Application shutdown: Closing browser instances...")
    try:
        if google_maps_browser:
            await google_maps_browser.close()
        if official_website_browser:
            await official_website_browser.close()
        if yelp_browser:
            await yelp_browser.close()
        if yellowpages_browser:
            await yellowpages_browser.close()
        if random_website_browser:
            await random_website_browser.close()
    except Exception as e:
        print(f"Error during browser cleanup: {e}")
    finally:
        print("Browser instances cleanup process finished.")

app = FastAPI(lifespan=lifespan)

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
    disable_security=False,

    # browser_binary_path='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    # browser_binary_path="C:\Program Files\Google\Chrome\Application\chrome.exe",
)

# yelp_browser_config = BrowserConfig(
#     headless=False, 
#     disable_security=True,
#     browser_binary_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
# )

# random_browser_config = BrowserConfig(
#     headless=False, 
#     disable_security=True,
#     browser_binary_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
# )

google_maps_browser = Browser(config=browser_config)
official_website_browser = Browser(config=browser_config)
yelp_browser = Browser(config=browser_config)
yellowpages_browser = Browser(config=browser_config)
random_website_browser = Browser(config=browser_config)

async def stream_franchise_details(franchise_name: str, country: str, state: str, city: str):
    shared_locations = set()
    active_agents = 0
    
    try:
        yield f"data: {json.dumps({'status': 'initializing', 'message': 'Starting search on multiple sources...'})}\n\n"
        
        result_queue = asyncio.Queue()
        
        async def process_agent_results(agent, source_name, queue, max_steps=10):
            nonlocal active_agents
            
            await queue.put(f"data: {json.dumps({'status': 'progress', 'source': source_name, 'message': f'Searching {source_name}...'})}\n\n")
            
            try:
                # NOTE: Removed active_agents increment here because we set it based on task count
                print(f"Starting search with {source_name} agent")
                
                controller = Controller(output_model=Locations)
                agent.controller = controller
                
                result = await agent.run(max_steps=max_steps)
                
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
                                        "Source": loc.get("source", "")
                                    }
                                    
                                    loc_id = f"{location['Address']}|{location['Phone']}"
                                    if loc_id not in shared_locations:
                                        shared_locations.add(loc_id)
                                        await queue.put(f"data: {json.dumps({'location': location, 'source': location['Source']})}\n\n")
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
                                            await queue.put(f"data: {json.dumps({'location': location, 'source': location['Source']})}\n\n")
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
                    # llm=llms[source_name],
                    llm=ChatOpenAI(model="gpt-4.1"),
                    initial_actions=[{'open_tab': {'url': url}}],
                    use_vision=True,
                    enable_memory=False,
                    # planner_llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=gemini_api_key),
                    # planner_interval=4,
                    # controller_kwargs={"browser_id": f"{source_name}_{franchise_name}_{city}"},
                    # page_extraction_llm=ChatOpenAI(model="gpt-4.1-nano"),
                    browser=browser,
                    # extend_system_message=f"IMPORTANT: Avoid Google Maps, Yelp, Yellow Pages, and the official {franchise_name} website (URLs containing '{franchise_name}'). "
                )
            except Exception as e:
                print(f"Error creating {source_name} agent: {str(e)}")
                return None

        google_maps_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} using Google Maps only. The google maps tab is already opened for you you just need to search."
                f"For each location, extract the exact address and phone number. Return all the different locations from the results in side pane. Do not deep dive any further."
                f"Return each location in JSON format: {{\"address\": \"<address>\", \"phone\": \"<phone>\", \"source\": \"Google Maps\"}}"
                f"Do not interact with the map just reterive the results which are shown in the sidebar."
                f"If only single result is shown in the sidebar then modify the search query."
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

        yelp_website_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} on Yelp. "
                f"If you encounter a CAPTCHA, try to skip it or find an alternative way to access the data. "
                f"For each location, extract the exact address and phone number. "
                f"Return the data in this exact format: "
                f'{{\"locations\": [{{\"address\": \"complete address\", \"phone\": \"phone number\", \"source\": \"Yelp\"}}]}}'
                f"Make sure to include the 'locations' key with a list of location objects. "
                f"IMPORTANT NOTE: Your task it to go to Yelp website only not any else. Do not reterive results from google search. Return only those which are on Yelp and are from {city}, {state}, {country}"
                f"If no locations found due to CAPTCHA or other issues, return: {{\"locations\": []}}"
            ),
            url=f"https://www.yelp.com/search?find_desc={franchise_name}&find_loc={city}+{state}+{country}",
            source_name="Yelp",
            browser=yelp_browser,
        )

        yellowpages_website_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} on Yellow Pages. "
                f"For each location, extract the exact address and phone number. "
                f"Return the data in this exact format: "
                f'{{\"locations\": [{{\"address\": \"complete address\", \"phone\": \"phone number\", \"source\": \"Yellow Pages\"}}]}}'
                f"Make sure to include the 'locations' key with a list of location objects."
                f"IMPORTANT NOTE: Your task it to go to Yellow Pages website only not any else. Do not reterive results from google search. Return only those which are on Yellow Pages and are from {city}, {state}, {country}"
            ),
            url=f"https://www.yellowpages.com/search?search_terms={franchise_name}&geo_location_terms={city}+{state}+{country}",
            source_name="Yellow Pages",
            browser=yellowpages_browser,
        )

        random_website_agent = create_agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} using alternative websites. "
                f"IMPORTANT: Avoid Google Maps, Yelp, Yellow Pages, and the official {franchise_name} website (URLs containing '{franchise_name}'). "
                f"For each location found, extract: "
                f"1. Complete street address "
                f"2. Phone number (use 'N/A' if not available) "
                f"3. Name of the website where you found the information "
                f"Return results in exactly this JSON format: "
                f'{{\"locations\": [{{\"address\": \"complete address\", \"phone\": \"phone number\", \"source\": \"website name\"}}]}}'
                f"CRITICAL: The 'source' field MUST be a proper, readable website name WITHOUT domains or URLs. "
                f"Examples: (These are just examples and not suggestion of websites to be searched. You need to search websites on your own from search results.)"
                f"- For 'tripadvisor.com' → use 'Trip Advisor' "
                f"- For 'locations.noodles.com' → use 'Noodles & Company' "
                f"- For 'restaurantji.com' → use 'Restaurant Ji' "
                f"Always convert domain names to proper business names by removing '.com', '.org', etc. and using proper spacing and capitalization."
                f"Visit only one website at a time. Do not click on multiple websites simultaneously."
                f"Return results from atlest 2-3 websites."
            ),
            url=f"https://www.bing.com/search?q={franchise_name}+locations+in+{city}+{state}+{country}",
            source_name="Other Websites",
            browser=random_website_browser,
        )

        
        tasks = [
            *([asyncio.create_task(process_agent_results(google_maps_agent, "Google Maps", result_queue, max_steps=10))] if google_maps_agent else []),
            *([asyncio.create_task(process_agent_results(official_website_agent, "Official Website", result_queue, max_steps=15))] if official_website_agent else []),
            *([asyncio.create_task(process_agent_results(yelp_website_agent, "Yelp", result_queue, max_steps=10))] if yelp_website_agent else []),
            *([asyncio.create_task(process_agent_results(yellowpages_website_agent, "Yellow Pages", result_queue, max_steps=10))] if yellowpages_website_agent else []),
            *([asyncio.create_task(process_agent_results(random_website_agent, "Other Websites", result_queue, max_steps=25))] if random_website_agent else []),
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
    uvicorn.run(app, host="0.0.0.0", port=8080)