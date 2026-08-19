from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.data.city_data import CITY_ROADS
from backend.data.emergency_data import EMERGENCY_VEHICLES

from backend.agents.traffic_agent import TrafficAgent
from backend.agents.route_agent import RouteAgent
from backend.agents.signal_agent import SignalAgent
from backend.agents.coordinator_agent import CoordinatorAgent

from backend.services.traffic_service import TrafficService


app = FastAPI(
    title="Emergency Corridor"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message":
            "Emergency Corridor Backend is running!"
    }


# =========================================================
# CITY
# =========================================================

@app.get("/city")
def get_city():

    return {
        "roads": CITY_ROADS
    }


# =========================================================
# TRAFFIC
# =========================================================

@app.get("/traffic")
def get_traffic():

    agent = TrafficAgent()

    return {
        "traffic_analysis":
            agent.analyze_traffic()
    }


# =========================================================
# ROUTE
# =========================================================

@app.get("/route")
def get_route(
    start: str = "J1",
    destination: str = "J5"
):

    agent = RouteAgent()

    return agent.find_best_route(
        start,
        destination
    )


# =========================================================
# GREEN CORRIDOR
# =========================================================

@app.get("/green-corridor")
def get_green_corridor(
    start: str = "J1",
    destination: str = "J5"
):

    route_agent = RouteAgent()
    signal_agent = SignalAgent()

    route_result = (
        route_agent.find_best_route(
            start,
            destination
        )
    )

    if "error" in route_result:
        return route_result

    signal_plan = (
        signal_agent.create_green_corridor(
            route_result["route"]
        )
    )

    return {
        "status":
            "ROUTE_FOUND",

        "start":
            route_result["start"],

        "destination":
            route_result["destination"],

        "emergency_route":
            route_result["route"],

        "route":
            route_result["route"],

        "roads":
            route_result["roads"],

        "total_distance_km":
            route_result[
                "total_distance_km"
            ],

        "estimated_time":
            route_result[
                "estimated_time"
            ],

        "traffic_status":
            route_result[
                "traffic_status"
            ],

        "signal_plan":
            signal_plan
    }


# =========================================================
# EMERGENCY VEHICLES
# =========================================================

@app.get("/emergency")
def get_emergency():

    return {
        "emergency_vehicles":
            EMERGENCY_VEHICLES
    }


# =========================================================
# EMERGENCY RESPONSE
# =========================================================

@app.get("/emergency-response")
def emergency_response():

    vehicle = EMERGENCY_VEHICLES[0]

    coordinator = CoordinatorAgent()

    return coordinator.process_emergency(
        vehicle["current_location"],
        vehicle["destination"]
    )


# =========================================================
# UPDATE TRAFFIC
# =========================================================

@app.get("/update-traffic")
def update_traffic(
    road_id: str,
    traffic: float
):

    service = TrafficService()

    updated_road = (
        service.update_traffic(
            road_id,
            traffic
        )
    )

    if updated_road is None:

        return {
            "status":
                "ERROR",

            "message":
                "Road not found"
        }

    return {
        "status":
            "TRAFFIC_UPDATED",

        "road":
            updated_road
    }