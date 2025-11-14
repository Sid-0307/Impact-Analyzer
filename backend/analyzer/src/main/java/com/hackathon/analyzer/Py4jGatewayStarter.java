package com.hackathon.analyzer;

import py4j.GatewayServer;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import com.hackathon.analyzer.AnalyzerService;
import py4j.GatewayServer;


@Component
public class Py4jGatewayStarter implements CommandLineRunner {

	private final AnalyzerService analyzerService;
	private GatewayServer gatewayServer;
	private final int gatewayPort = 25333;

	public Py4jGatewayStarter(AnalyzerService analyzerService) {
        this.analyzerService = analyzerService;
    }

    @Override
    public void run(String... args) throws Exception {

        gatewayServer = new GatewayServer(analyzerService, gatewayPort);
        gatewayServer.start();
        System.out.println("Py4J Gateway Server started on port " + gatewayPort);

        // Optional: Add a shutdown hook for clean termination
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (gatewayServer != null) {
                gatewayServer.shutdown();
                System.out.println("Py4J Gateway Server shut down.");
            }
        }));
    }
}
