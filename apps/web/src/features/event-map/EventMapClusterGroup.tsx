import { createLayerComponent } from "@react-leaflet/core";
import type { ReactNode } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type ClusterProps = L.MarkerClusterGroupOptions & {
  children?: ReactNode;
};

/**
 * Wraps map pins so nearby venues share one ≥24×24 cluster target until zoomed/spiderfied.
 * Clears WCAG target-size failures from overlapping emoji pins at city zoom.
 */
export const EventMapClusterGroup = createLayerComponent<L.MarkerClusterGroup, ClusterProps>(
  function createMarkerClusterGroup({ children: _children, ...options }, context) {
    const instance = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
      ...options
    });
    return {
      instance,
      context: { ...context, layerContainer: instance }
    };
  }
);
