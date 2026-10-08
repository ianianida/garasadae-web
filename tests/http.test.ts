import test from "node:test";
import assert from "node:assert/strict";
import { assertSameOrigin } from "../src/lib/http";

test("서버 내부 주소와 브라우저 주소가 다른 프록시에서도 자기 사이트 요청을 받는다", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://0.0.0.0:3000/api/draw", {headers:{origin:"http://localhost:3000",host:"localhost:3000"}})));
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://internal/api/draw", {headers:{origin:"https://garasadae-web.vercel.app",host:"garasadae-web.vercel.app","x-forwarded-proto":"https"}})));
});
test("다른 Origin이나 클라이언트가 넣은 forwarded host는 허용하지 않는다", () => {
  assert.throws(() => assertSameOrigin(new Request("https://garasadae-web.vercel.app/api/draw", {headers:{origin:"https://example.org",host:"garasadae-web.vercel.app","x-forwarded-host":"example.org"}})), /INVALID_ORIGIN/);
  assert.throws(() => assertSameOrigin(new Request("https://garasadae-web.vercel.app/api/draw")), /INVALID_ORIGIN/);
});
