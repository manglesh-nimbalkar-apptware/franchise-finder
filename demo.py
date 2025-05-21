from browser_use import Agent, Controller, BrowserConfig, Browser
from browser_use.browser.context import BrowserContext, BrowserContextConfig
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import asyncio
import pprint
from pydantic import BaseModel, SecretStr
from typing import List
import os

load_dotenv()

gemini_api_key = os.getenv('GOOGLE_API_KEY', '')

franchise_name = "El Pollo Loco"
city = "Denver"
state = "Colorado"
country = "USA"
# model = "chatgpt"
model = "gemini"

class Location(BaseModel):
    address: str
    phone: str
    source: str

class Locations(BaseModel):
    locations: List[Location]

browser_config = BrowserConfig(
    headless=False,
    # browser_binary_path='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',   # MS Edge Broswer
    browser_binary_path="C:\Program Files\Google\Chrome\Application\chrome.exe",     # Chrome Browser
)

browser = Browser(
    config=browser_config,
)

context_config = BrowserContextConfig(
    window_width=1536,
    window_height=864,
    viewport_expansion=-1,
)

browser_context = BrowserContext(
    browser=browser,
    config=context_config
)

controller = Controller(output_model=Locations)

llm = ChatOpenAI(model="gpt-4o") if model == "chatgpt" else ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=gemini_api_key)
extraction_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-lite", api_key=gemini_api_key)

# agent_google_maps = Agent(
#             task=(
#                 f"Find {franchise_name} locations in {city}, {state}, {country} using Google Maps. "
#                 f"For each location, extract the exact address and phone number. Do not open each and every location detail. Just fill it if it's present on the page showing all the locations."
#                 f"Return each location in JSON format: {{\"Address\": \"<address>\", \"Phone\": \"<phone>\", \"Source\": \"Google Maps\"}}"
#             ),
#             llm=llm,
#             initial_actions=[{'open_tab': {'url': f'https://www.google.com/maps/search/{franchise_name}+{city}+{state}+{country}'}}],
#             use_vision=True,
#             enable_memory=False,
#             controller=controller,
#             # page_extraction_llm=extraction_llm,
# )

official_website_agent = Agent(
            task=(
                f"Find {franchise_name} locations in {city}, {state}, {country} by visiting the official website only using google search. "
                f"For each location, extract the exact address and phone number."
                f"Return each location in JSON format: {{\"address\": \"<address>\", \"phone\": \"<phone>\", \"source\": \"Official Website\"}}"
            ),
            llm=llm,
            initial_actions=[{'open_tab': {'url': f'https://www.bing.com/search?q={franchise_name}+official+website+{city}+{state}+{country}'}}],
            use_vision=True,
            enable_memory=False,
            controller=controller,
            browser=browser,
            browser_context=browser_context,
            # page_extraction_llm=extraction_llm,
        )

async def main():
    # history = await agent_google_maps.run(max_steps=10)
    history = await official_website_agent.run(max_steps=10)

    await browser.close()
    print("Browser closed successfully!")

    await browser_context.close()
    print("Browser context closed successfully!")

    return history

if __name__ == '__main__':
    result = asyncio.run(main())
    print(result)
    print("\n\n\n\n")
    print(result.final_result())
    print(type(result.final_result()))

    with open("result.txt", "w") as f:
        f.write(result.final_result())
    
    print("Locations stored to result.txt file successfully!")
    
    
