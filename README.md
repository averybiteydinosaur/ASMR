# Bare Metal
Build with Cargo, point at an existing Postgres DB

# Rust, but no postgres
docker pull postgres
sudo docker run --name posty -e POSTGRES\_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
sudo psql --host=localhost --username=postgres --dbname=postgres

# Docker Build Commands  
docker build -t rss:latest -f ./Dockerfile .  
docker system prune  
docker run --name rss -p 8080:8080 rss:latest  
Ctrl + C  
docker start rss  

# Docker Compose
sudo docker compose up -d --build
