# Build stage
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# Runtime stage: small JRE image, non-root user
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 portal
WORKDIR /app
COPY --from=build /src/target/secure-student-portal-1.0.0.jar app.jar
USER portal
# inside the container we must listen on all interfaces; compose publishes it on 127.0.0.1 only
ENV SERVER_ADDRESS=0.0.0.0
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
