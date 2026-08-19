from backend.agents.traffic_agent import TrafficAgent
from backend.agents.route_agent import RouteAgent
from backend.agents.signal_agent import SignalAgent


class CoordinatorAgent:

    def process_emergency(self, start, destination):

        # Step 1: Analyze current traffic
        traffic_agent = TrafficAgent()
        traffic_data = traffic_agent.analyze_traffic()

        # Step 2: Find the best route
        route_agent = RouteAgent()
        route_result = route_agent.find_best_route(
            start,
            destination
        )

        if "error" in route_result:
            return {
                "status": "FAILED",
                "reason": route_result["error"]
            }

        # Step 3: Create green corridor
        signal_agent = SignalAgent()
        signal_plan = signal_agent.create_green_corridor(
            route_result["route"]
        )

        return {
            "status": "GREEN_CORRIDOR_CREATED",
            "traffic_analysis": traffic_data,
            "emergency_route": route_result["route"],
            "estimated_time": route_result["estimated_time"],
            "signal_plan": signal_plan
        }