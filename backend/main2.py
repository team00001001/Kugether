from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# 프론트가 보낼 데이터의 모양을 미리 정의합니다.
class Item(BaseModel):
    productName: str
    price: int
    maxPeople: int
    location: str
    description: str

# 글쓰기 데이터를 받는 창구 (POST 방식)
@app.post("/api/posts")
def create_post(item: Item):
    print(f"새로운 공동구매 등록: {item.productName}, {item.price}원")
    return {"message": "서버가 프론트엔드의 데이터를 성공적으로 받았습니다!"}