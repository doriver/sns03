# SNS03
* 게시판(이미지 첨부 글, 댓글, 좋아요)과 단체 채팅기능이 있는 작은SNS
* 기존에 SpringBoot + MySQL 이던걸 **Express + MongoDB로 컨버트**
   * https://github.com/doriver/xxSNS

해당 README는 작성중(미완성)입니다.

### 인증
<details>
  <summary>작성 예정</summary>
  <div>
    <ul>
      <li> 1
      </li>
      <li> 2
      </li>
    </ul>
  </div>
</details>

### 게시판
<details>
  <summary>게시글 조회수</summary>
  <div>
    <ul>
      <li> 로그인한 유저는 userId , 비로그인 유저는 ip를 기준으로 조회수 증가
      </li>
      <li> Redis로 조회수 중복 방지 <br>
         : 같은 사용자가 30분 내에 재조회하면 카운트x (TTL 30분)
      </li>
      <img src="demo/code/post_view_count.png" style="width: 500px"/>
    </ul>
  </div>
</details>


### 프론트는 순수JS로 SPA 
