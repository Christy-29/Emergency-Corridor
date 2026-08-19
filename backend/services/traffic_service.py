from backend.data.city_data import CITY_ROADS


class TrafficService:

    def update_traffic(
        self,
        road_id,
        traffic
    ):

        traffic = max(
            0,
            min(
                float(traffic),
                100
            )
        )

        for road in CITY_ROADS:

            if road["road_id"] == road_id:

                road["traffic"] = traffic

                return road

        return None