from backend.data.city_data import CITY_ROADS


class TrafficAgent:

    def analyze_traffic(self):
        traffic_analysis = []

        for road in CITY_ROADS:

            traffic = road["traffic"]
            speed = road["speed_kmph"]

            if traffic >= 70:
                status = "HIGH"
            elif traffic >= 40:
                status = "MEDIUM"
            else:
                status = "LOW"

            traffic_analysis.append({
                "road_id": road["road_id"],
                "traffic": traffic,
                "speed_kmph": speed,
                "status": status
            })

        return traffic_analysis