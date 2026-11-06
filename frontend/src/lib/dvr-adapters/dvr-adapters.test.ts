import { describe, expect, it } from "vitest";
import {
  DvrAdapterFactory,
  GenericOnvifAdapter,
  GenericRtspAdapter,
  HikvisionDvrAdapter,
  IntelbrasDvrAdapter,
  MockOrSimulatorAdapter,
  maskRtspCredentials,
} from "./index";

describe("DvrAdapterFactory & Brand Adapters (Fase 2)", () => {
  it("masks credentials in RTSP URLs while preserving host and path", () => {
    const raw = "rtsp://admin:SuperSecret123@192.168.1.64:554/Streaming/Channels/101";
    expect(maskRtspCredentials(raw)).toBe(
      "rtsp://admin:****@192.168.1.64:554/Streaming/Channels/101"
    );
  });

  it("instantiates HikvisionDvrAdapter and generates ISAPI/RTSP URLs", async () => {
    const adapter = DvrAdapterFactory.create({
      name: "DVR Hikvision",
      brand: "hikvision",
      host: "192.168.1.64",
      rtsp_port: 554,
      username: "admin",
      password: "secret",
      total_channels: 2,
    });

    expect(adapter).toBeInstanceOf(HikvisionDvrAdapter);
    const mainUrl = await adapter.getCameraStream("1", "main");
    const subUrl = await adapter.getCameraStream("1", "sub");

    expect(mainUrl).toBe("rtsp://admin:****@192.168.1.64:554/Streaming/Channels/101");
    expect(subUrl).toBe("rtsp://admin:****@192.168.1.64:554/Streaming/Channels/102");
  });

  it("instantiates IntelbrasDvrAdapter and generates RealMonitor RTSP URLs", async () => {
    const adapter = DvrAdapterFactory.create({
      name: "DVR Intelbras",
      brand: "intelbras",
      host: "192.168.1.100",
      rtsp_port: 554,
      username: "admin",
      password: "123",
      total_channels: 4,
    });

    expect(adapter).toBeInstanceOf(IntelbrasDvrAdapter);
    const mainUrl = await adapter.getCameraStream("2", "main");
    const subUrl = await adapter.getCameraStream("2", "sub");

    expect(mainUrl).toBe(
      "rtsp://admin:****@192.168.1.100:554/cam/realmonitor?channel=2&subtype=0"
    );
    expect(subUrl).toBe(
      "rtsp://admin:****@192.168.1.100:554/cam/realmonitor?channel=2&subtype=1"
    );
  });

  it("instantiates GenericOnvifAdapter and GenericRtspAdapter", async () => {
    const onvif = DvrAdapterFactory.create({
      name: "Camera ONVIF",
      brand: "onvif",
      host: "10.0.0.50",
      username: "operador",
      password: "pwd",
    });
    expect(onvif).toBeInstanceOf(GenericOnvifAdapter);
    expect(await onvif.getCameraStream("1", "main")).toBe(
      "rtsp://operador:****@10.0.0.50:554/onvif/profile1/ch1"
    );

    const generic = DvrAdapterFactory.create({
      name: "Camera IP",
      brand: "generic",
      host: "10.0.0.51",
      username: "admin",
      password: "pwd",
    });
    expect(generic).toBeInstanceOf(GenericRtspAdapter);
    expect(await generic.getCameraStream("1", "sub")).toBe(
      "rtsp://admin:****@10.0.0.51:554/live/ch1/stream2"
    );
  });

  it("runs MockOrSimulatorAdapter testConnection and discoverCameras", async () => {
    const mock = DvrAdapterFactory.create({
      name: "Simulador Fabril",
      brand: "mock",
      host: "127.0.0.1",
      username: "admin",
      total_channels: 3,
    });

    expect(mock).toBeInstanceOf(MockOrSimulatorAdapter);
    const conn = await mock.testConnection();
    expect(conn.success).toBe(true);

    const cams = await mock.discoverCameras();
    expect(cams).toHaveLength(3);
    expect(cams[0].online).toBe(true);
    expect(cams[0].streamUrl).toBe("mock://127.0.0.1/channels/1/main");
  });
});


import { streamMonitorService } from "./stream-monitor";

describe("StreamMonitorService & Circuit Breaker (Fase 3)", () => {
  it("computes exponential backoff capped at 30s", () => {
    expect(streamMonitorService.computeBackoffSeconds(1)).toBe(1);
    expect(streamMonitorService.computeBackoffSeconds(2)).toBe(2);
    expect(streamMonitorService.computeBackoffSeconds(3)).toBe(4);
    expect(streamMonitorService.computeBackoffSeconds(4)).toBe(8);
    expect(streamMonitorService.computeBackoffSeconds(5)).toBe(16);
    expect(streamMonitorService.computeBackoffSeconds(6)).toBe(30);
    expect(streamMonitorService.computeBackoffSeconds(10)).toBe(30);
  });

  it("monitors Mock DVR health and toggles stream subtype (main vs sub)", async () => {
    const mockDvr = {
      id: "dvr-test-monitor",
      name: "DVR Mock Monitorado",
      brand: "mock" as const,
      host: "127.0.0.1",
      rtsp_port: 8090,
      http_port: 8090,
      username: "admin",
      total_channels: 2,
      status: "online" as const,
    };

    const state = await streamMonitorService.checkDvrHealth(mockDvr);
    expect(state.status).toBe("online");
    expect(state.circuitState).toBe("CLOSED");
    expect(state.activeSubtype).toBe("main");

    const updated = streamMonitorService.setStreamSubtype(mockDvr.id, "sub");
    expect(updated?.activeSubtype).toBe("sub");

    const events = streamMonitorService.getEvents(10);
    expect(events.length).toBeGreaterThan(0);
  });
});
