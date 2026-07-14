# Serve o site estático de atribuição via nginx.
#   docker build -t atribuicao .
#   docker run --rm -p 8080:80 atribuicao
# Depois abra http://localhost:8080
FROM nginx:1.27-alpine
COPY web/ /usr/share/nginx/html/
EXPOSE 80
