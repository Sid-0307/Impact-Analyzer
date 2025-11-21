FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY gradle/ ./gradle
COPY ./gradlew ./
COPY src ./src
RUN /app/gradlew build

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/analyzer-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
