package com.hackathon.analyzer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;


@SpringBootApplication(scanBasePackages = "com.hackathon")
@ComponentScan(basePackages = {"com.hackathon"})
public class AnalyzerApplication {
	
	public static void main(String[] args) throws Exception {
		SpringApplication.run(AnalyzerApplication.class,args);
	}

}
