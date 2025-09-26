PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_data TEXT NOT NULL,
        state VARCHAR(255),
        access_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      , team_id TEXT);
INSERT INTO sessions VALUES('sess_nPOxouNTdoQYY8iamNzfaKupJy5si3mw','user_3oj6F5S9TQhNE','{"id":"user_3oj6F5S9TQhNE","name":"slicklava","email":"crosiaretan@gmail.com","image":"https://img-v2-prod.whop.com/HNlBVXNM0gRFgpghyjAQcdNxPBk7BiZSNxLQeI2h4jE/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/panda.png"}',NULL,'kM8gUOdRiPVE6uNkqK1UqM4jw1W6dJDIZLLiFf7RIqk','2025-09-26T17:51:19.228Z','2025-09-24 19:14:34','2025-09-25 17:51:19',NULL);
INSERT INTO sessions VALUES('sess_cwxobRUDqZL0da240SmYnN7Vb0wmfFwM','user_Ah02GQmkZf2pn','{"id":"user_Ah02GQmkZf2pn","name":"erickdoesntsolo","email":"erickhasstories@gmail.com","image":"https://assets.whop.com/uploads/2025-03-14/user_9236076_f1802b03-f240-4afa-b7aa-ac2594b99e23.jpeg"}',NULL,'16OnaBl_kdbOkNA2XOfWBHlG1_JYUlc5EYm2lnRLec0','2025-09-26T00:17:05.541Z','2025-09-25 00:17:00','2025-09-25 00:17:05',NULL);
INSERT INTO sessions VALUES('sess_kfzSFenipjM6v9pgmJtx8rY3GqZWvjxS','','{}','feJV77Vd4AjpjdWb0JBVhY1KxBDSkmAW',NULL,'2025-09-26T01:00:29.928Z','2025-09-25 01:00:29','2025-09-25 01:00:29',NULL);
INSERT INTO sessions VALUES('sess_CRadVdV4QiHDtER2hYEnVmIvpl5sFe9Y','user_zuwWaJg9Q1vEG','{"id":"user_zuwWaJg9Q1vEG","name":"antonloth79028","email":"antonloth79028@gmail.com","image":"https://cdn.discordapp.com/avatars/781257197753335828/0cd6e96ddfb8c1806a291f064ab35c5a"}',NULL,'ZQBrFldMCievrz45DrF_tv90WPv9cBdqC3TK-1CHE3s','2025-09-26T01:00:37.126Z','2025-09-25 01:00:30','2025-09-25 01:00:37',NULL);
INSERT INTO sessions VALUES('sess_4KezwWUQZndST7XpH5D8sSs6mSR1mhzB','user_ZWCuZdPsth5YJ','{"id":"user_ZWCuZdPsth5YJ","name":"kevious","email":"kevinpuxingzhou@gmail.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png"}',NULL,'qqljC0BNprDuGXQkV8ajMedpEDhIa23pgOpn7K9beVQ','2025-09-26T01:17:35.604Z','2025-09-25 01:15:28','2025-09-25 01:17:35',NULL);
INSERT INTO sessions VALUES('sess_KeRhzt25pH29o5OlY4sMQMgpaARbGKpD','user_Is8LpKs7vQHX2','{"id":"user_Is8LpKs7vQHX2","name":"mutualfeint1d9e","email":"sgtdanny96@gmail.com","image":"https://ui-avatars.com/api/?name=zesty821&background=535961&color=fff&format=png"}',NULL,'NkSWYWLjcWdusehKLhfwDdiKZjdV_EmwEFxg8MMeQCA','2025-09-26T02:58:30.686Z','2025-09-25 02:58:22','2025-09-25 02:58:30',NULL);
INSERT INTO sessions VALUES('sess_zupXCIB7NnkIlTMVLhXnSM8rlkv3O2xq','user_0zZYR31XAbMO1','{"id":"user_0zZYR31XAbMO1","name":"alexuvaro00","email":"alexuvaro00@gmail.com","image":"https://assets.whop.com/uploads/2025-05-15/user_6677384_cecba203-5bbf-4438-a0c0-dd9e923d94ba.jpeg"}',NULL,'Nosx_50l8WP1oijPJxVs1a9BCfoan7bJifsPmhfWtHo','2025-09-26T03:14:08.781Z','2025-09-25 03:13:29','2025-09-25 03:14:08',NULL);
INSERT INTO sessions VALUES('sess_fbjb2xe0FazhrVNWI14fWOIhCtyfqPrm','','{}','ZL4ZfyAro0if8N5r7sQ4fD1jk46v1Evu',NULL,'2025-09-26T05:14:28.360Z','2025-09-25 05:14:28','2025-09-25 05:14:28',NULL);
INSERT INTO sessions VALUES('sess_5wuyTvDRZiy96lxccQYbRoPLcYwRwBH5','','{}','OBF9CixaEqOk3kEQaKat3Z3Yi7Fqhcxf',NULL,'2025-09-26T05:14:30.780Z','2025-09-25 05:14:30','2025-09-25 05:14:30',NULL);
INSERT INTO sessions VALUES('sess_5KxQHF9AZ2BkwDlPp6xgET7nsK4kG2Kc','user_uiK5atQTklVBy','{"id":"user_uiK5atQTklVBy","name":"wifiincome","email":"elijahkigozi.business@gmail.com","image":"https://ui-avatars.com/api/?name=Elijah%20Kigozi&background=535961&color=fff&format=png"}',NULL,'z6JctZtwCzj6o-3PzaFgWjhxB7A2KRZqzPSnmX0bi5A','2025-09-26T05:14:37.179Z','2025-09-25 05:14:33','2025-09-25 05:14:37',NULL);
INSERT INTO sessions VALUES('sess_5TFqXr6YIJRlk0xDTJ93oUX2iWkmdRqh','','{}','WbPvQ0Apg3qX4DPtPXrnF4bwosdhfhwe',NULL,'2025-09-26T05:31:06.922Z','2025-09-25 05:31:06','2025-09-25 05:31:06',NULL);
INSERT INTO sessions VALUES('sess_fVKbk1Xh1Em2DHR4CvEZK428eJ5Ih4FR','','{}','poRzKSOSUPglQFrff2BqLefdkbsCDfe0',NULL,'2025-09-26T05:31:08.630Z','2025-09-25 05:31:08','2025-09-25 05:31:08',NULL);
INSERT INTO sessions VALUES('sess_fewswyaKouCpFEmwdhoWrwq9qSip6S59','','{}','djfsy4Su4P0p9y17oecuScSuqfcsyRBl',NULL,'2025-09-26T05:31:10.154Z','2025-09-25 05:31:09','2025-09-25 05:31:09',NULL);
INSERT INTO sessions VALUES('sess_vgrvTpostPEYCUo3p0CEHpzcU7fFdl9a','','{}','T75pxKAz2aX2pHM6SdTR8p2cNar4VWJy',NULL,'2025-09-26T05:31:11.580Z','2025-09-25 05:31:11','2025-09-25 05:31:11',NULL);
INSERT INTO sessions VALUES('sess_TxcsE7Y9R8gaDmxFMGUm1UexAdsTtqUO','user_rs8F3iJo5DKoh','{"id":"user_rs8F3iJo5DKoh","name":"raphslick","email":"rafhaelgaveriaiv@gmail.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_rs8F3iJo5DKoh","originalEmail":"rafhaelgaveriaiv@gmail.com","startedAt":"2025-09-26T06:23:39.924Z"}}',NULL,'90hGcq9Zu0p8O3qDeyL9QhRC09rzaDan4p5epPz1EtI','2025-09-27T06:23:30.703Z','2025-09-25 05:31:12','2025-09-26 06:23:39',NULL);
INSERT INTO sessions VALUES('sess_o1pWqDua8Hp0pdoedOsK5ftQKo38tT3N','user_ZnHUlDNVOnsaZ','{"id":"user_ZnHUlDNVOnsaZ","name":"ionicwin","email":"manallobryan@gmail.com","image":"https://ui-avatars.com/api/?name=ionicwin&background=535961&color=fff&format=png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_ZnHUlDNVOnsaZ","originalEmail":"manallobryan@gmail.com","startedAt":"2025-09-25T07:19:44.142Z"}}',NULL,'e-Obj4RoZ-QO9XRqo2gwIaOOJQB0MU5GsDLqrn6IwKE','2025-09-26T07:19:23.348Z','2025-09-25 06:08:13','2025-09-25 07:19:44',NULL);
INSERT INTO sessions VALUES('sess_FZeSecLdUODcIQqmZnUysIqNZI9vI6d4','','{}','6oV8Qzt3TFxw0OOIPQji3dOlGE7QB1GT',NULL,'2025-09-26T06:13:37.374Z','2025-09-25 06:13:37','2025-09-25 06:13:37',NULL);
INSERT INTO sessions VALUES('sess_Q9nJLHCbhVPxfwUBLuKzSDvBc4X1nnF7','user_wz28ulMWdyLha','{"id":"user_wz28ulMWdyLha","name":"cuharti","email":"cuharty@gmail.com","image":"https://img-v2-prod.whop.com/HNlBVXNM0gRFgpghyjAQcdNxPBk7BiZSNxLQeI2h4jE/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/panda.png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_wz28ulMWdyLha","originalEmail":"cuharty@gmail.com","startedAt":"2025-09-25T07:34:47.741Z"}}',NULL,'hc4bB3-fd05A-94sJI_6eRdwa9js7L_Vxio2MOWKfdo','2025-09-26T07:34:30.006Z','2025-09-25 07:34:23','2025-09-25 07:34:47',NULL);
INSERT INTO sessions VALUES('sess_Wjlm8NQuLhUDZc48CyOH56MH5YD0VXSH','user_ZWCuZdPsth5YJ','{"id":"user_ZWCuZdPsth5YJ","name":"kevious","email":"kevinpuxingzhou@gmail.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png"}',NULL,'oB0_UmMc_8ztq9WlwLrPLeq33ecVD0wM8KXIAuoq0LQ','2025-09-26T08:21:01.432Z','2025-09-25 08:20:56','2025-09-25 08:21:01',NULL);
INSERT INTO sessions VALUES('sess_yOsQ9J2Onl2XLkiwSiV509ejxVTIS1OB','user_ML5kJaeHikfZi','{"id":"user_ML5kJaeHikfZi","name":"villarazajestoni","email":"villaraza.jestoni24@gmail.com","image":"https://ui-avatars.com/api/?name=villarazajestoni&background=535961&color=fff&format=png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_ML5kJaeHikfZi","originalEmail":"villaraza.jestoni24@gmail.com","startedAt":"2025-09-25T10:18:06.550Z"}}',NULL,'gQw0O6dpEuSORHQyg_e7c3D_Fw0FPgDYz3le_FmbbAE','2025-09-26T10:17:45.399Z','2025-09-25 09:29:53','2025-09-25 10:18:06',NULL);
INSERT INTO sessions VALUES('sess_xpHsNsz809jwAkaOlx5J8b30WzZSHG55','','{}','6Jh42hmTnnZHEVlPny7arQEzvk8CEaee',NULL,'2025-09-26T09:59:27.179Z','2025-09-25 09:59:27','2025-09-25 09:59:27',NULL);
INSERT INTO sessions VALUES('sess_PiGM3zHTJruLL3Lrk9z7eauVjCQVYO29','','{}','Z0bKKENZfQ9YtOTqOQHxaD9rHq4PVQKM',NULL,'2025-09-26T09:59:30.667Z','2025-09-25 09:59:30','2025-09-25 09:59:30',NULL);
INSERT INTO sessions VALUES('sess_JGasGiLJ9glqgGjq5OkGqaToyoIeXQ6w','','{}','qQ7Yo3zNpr71Izd3RnefXKvwexmclDu2',NULL,'2025-09-26T09:59:34.165Z','2025-09-25 09:59:34','2025-09-25 09:59:34',NULL);
INSERT INTO sessions VALUES('sess_a3hYdplWzTlHVLckNTtmOOcYY89HKkrC','','{}','ae0oJC9iCCgFKWVLvhBCkRWHOufPZlMN',NULL,'2025-09-26T09:59:37.673Z','2025-09-25 09:59:37','2025-09-25 09:59:37',NULL);
INSERT INTO sessions VALUES('sess_cAiE3kr2XNVGBaebL7FejneH5JCOlUuJ','user_3W8vvuOZ1weXs','{"id":"user_3W8vvuOZ1weXs","name":"glibbladeb1","email":"organicmarlboro@gmail.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png"}',NULL,'TkN0i92j9iZ4yMJ2BpRjzw2Nn9Fz2XIXLj2WBW4dBwE','2025-09-27T03:50:37.723Z','2025-09-25 09:59:41','2025-09-26 03:50:37',NULL);
INSERT INTO sessions VALUES('sess_d0lQsltB8xeMOFhbKtuWEa1FZGjRbAfT','','{}','EvqGQy6Cgt04uEgk5ovTmLPWSizxmmIe',NULL,'2025-09-26T16:39:15.843Z','2025-09-25 16:39:16','2025-09-25 16:39:16',NULL);
INSERT INTO sessions VALUES('sess_rgwkHDSaDJMjEdaypmVPWM4Sce5FafR9','user_Up69zFhBDauaS','{"id":"user_Up69zFhBDauaS","name":"ejeacorp","email":"whopfinal@ejeacorp.com","image":"https://assets.whop.com/uploads/2025-09-25/user_17739758_3b476360-def6-42d9-b933-af1d203bd982.jpeg"}',NULL,'YZBN_dAk1rDFxBSCHqO97_qTwvzYVv62bU5Sys3Iwuo','2025-09-26T16:51:40.004Z','2025-09-25 16:46:00','2025-09-25 16:51:40',NULL);
INSERT INTO sessions VALUES('sess_FsbBOvDX2i3lMfEReZVHhIjhhuPaZzJ7','user_Up69zFhBDauaS','{"id":"user_Up69zFhBDauaS","name":"ejeacorp","email":"whopfinal@ejeacorp.com","image":"https://assets.whop.com/uploads/2025-09-25/user_17739758_3b476360-def6-42d9-b933-af1d203bd982.jpeg"}',NULL,'POXSNbnMWNhC9jnLnoI91Hrnn70iiv11O9xBhaAx03Q','2025-09-26T16:56:30.685Z','2025-09-25 16:55:34','2025-09-25 16:56:30',NULL);
INSERT INTO sessions VALUES('sess_dNDhoZFeN1v7J1OIUk2IFAPKLkebtbKK','user_wqKEpg5GSHRKn','{"id":"user_wqKEpg5GSHRKn","name":"mootthorn","email":"whop2@ejeacorp.com","image":"https://ui-avatars.com/api/?name=mootthorn&background=535961&color=fff&format=png"}',NULL,'q3F7lZ1Ftdj01kP37yBJxY17LX7UjNo0kf11HQpXBQ4','2025-09-26T17:01:40.272Z','2025-09-25 17:01:09','2025-09-25 17:01:40',NULL);
INSERT INTO sessions VALUES('sess_CHWx5c1YpVyG6yTO78zgdoASvECMymlR','','{}','JXYSFC9gtT8yugZsonKKKWt3JRSqokcd',NULL,'2025-09-26T17:04:29.969Z','2025-09-25 17:04:30','2025-09-25 17:04:30',NULL);
INSERT INTO sessions VALUES('sess_j8p9dY6hawORQ1TXzj5K48aJhJDW0euR','user_YqkDDZEL7BeT6','{"id":"user_YqkDDZEL7BeT6","name":"ejejejej","email":"whop@ejeacorp.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_YqkDDZEL7BeT6","originalEmail":"whop@ejeacorp.com","startedAt":"2025-09-25T17:05:26.119Z"}}',NULL,'_Dm5qqzh7AbS8gHt76M_VjXQzWxn1Pom1k08fBU3RcA','2025-09-26T17:05:08.939Z','2025-09-25 17:04:33','2025-09-25 17:05:26',NULL);
INSERT INTO sessions VALUES('sess_PUr0u4xHh4iAH2o4ohR3T24gqz1LUWeR','','{}','kcT1jdbr2FvgKnanEnWkgVdpsbMcXQt1',NULL,'2025-09-26T17:58:41.909Z','2025-09-25 17:58:41','2025-09-25 17:58:41',NULL);
INSERT INTO sessions VALUES('sess_EWHQD5E8VtrcoqC8ewvuE1bVDnB07ibO','','{}','dXYYgmaf7129MqVJTsnVDjcxFbWvz1ea',NULL,'2025-09-26T17:58:42.749Z','2025-09-25 17:58:42','2025-09-25 17:58:42',NULL);
INSERT INTO sessions VALUES('sess_hN33OaI9zmk9LCNgozXFdB6AhSqrJcog','','{}','kCZfo3oLPGE78lFxffHlNm65V8Xk4Tp1',NULL,'2025-09-26T17:58:43.986Z','2025-09-25 17:58:43','2025-09-25 17:58:43',NULL);
INSERT INTO sessions VALUES('sess_R4cgFsUs0nG9YcplxDo7jEwNPypDt6kD','user_7vMF2GI5Dz3YT','{"id":"user_7vMF2GI5Dz3YT","name":"justin-m-lee-dev","email":"justin.m.lee.dev@gmail.com","image":"https://img-v2-prod.whop.com/HNlBVXNM0gRFgpghyjAQcdNxPBk7BiZSNxLQeI2h4jE/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/panda.png"}',NULL,'nu5GA5VXsVAixcVeghyiabUVXYEkPkhHjorNor1mHy0','2025-09-26T17:58:51.283Z','2025-09-25 17:58:44','2025-09-25 17:58:51',NULL);
INSERT INTO sessions VALUES('sess_zJie8EYnkeU3iggnV0Pn1DWIh7Hv1dg9','','{}','ddDRqYZqkVumomHeAAtte03MBcLWbCdF',NULL,'2025-09-26T17:58:45.680Z','2025-09-25 17:58:45','2025-09-25 17:58:45',NULL);
INSERT INTO sessions VALUES('sess_pU3qhVDSdTWrEEdtr7HCs0W5ALSK746M','','{}','av6JiTry3MxJCyteoiE9Qrla6yHXF7vJ',NULL,'2025-09-26T18:27:51.243Z','2025-09-25 18:27:51','2025-09-25 18:27:51',NULL);
INSERT INTO sessions VALUES('sess_Z7mOmtW7d0mMHzxaG8QQqiOIR91jbnur','user_wVUCbtEuyXgEC','{"id":"user_wVUCbtEuyXgEC","name":"vlb8","email":"vl@black.com","image":"https://cdn.discordapp.com/avatars/1104409291512889474/d1c4d366d7d0f7074bb78ae3a0039531"}',NULL,'rD3HK3C80z75HaicgPohdZ3D4fkavwsD2Ej1Gt48hic','2025-09-26T18:28:06.230Z','2025-09-25 18:27:55','2025-09-25 18:28:06',NULL);
INSERT INTO sessions VALUES('sess_lViZcW6fiCQtdLs6ilIn23E6uWiQSDyC','user_GQjRZW1y0napk','{"id":"user_GQjRZW1y0napk","name":"ethanclipzzzz","email":"litgameryt@gmail.com","image":"https://assets.whop.com/uploads/2025-05-11/user_3230649_2fb4dd94-1fd9-45b0-94c2-3b62b0f2eaba.jpeg"}',NULL,'l-taJ2qtRgi7MqE5pbMW3-WtIyQoagBUKSlZJb6HeoE','2025-09-26T19:50:15.630Z','2025-09-25 19:50:07','2025-09-25 19:50:15',NULL);
INSERT INTO sessions VALUES('sess_pnqCK3PyCpqpj6rW6wNH7I8se7HpFN6T','user_uZ1HxkxpdULMs','{"id":"user_uZ1HxkxpdULMs","name":"maxtl12","email":"cranapplellc@gmail.com","image":"https://img-v2-prod.whop.com/HNlBVXNM0gRFgpghyjAQcdNxPBk7BiZSNxLQeI2h4jE/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/panda.png"}',NULL,'_HVpvFltfGstfPVqI0tLYCLIg4LFZgwU9ddoi-fSn9Y','2025-09-26T20:02:54.009Z','2025-09-25 20:02:49','2025-09-25 20:02:54',NULL);
INSERT INTO sessions VALUES('sess_qHoh5FDoGGsl5mwFsDsKdZfq0uZMYjvp','','{}','6CkflQkpCE36ULIrRrkrQK3O1JWCnCia',NULL,'2025-09-26T20:32:53.429Z','2025-09-25 20:32:53','2025-09-25 20:32:53',NULL);
INSERT INTO sessions VALUES('sess_RPPYJ9kjsBya0XAMnJk9ZLHcfbhEBQtZ','','{}','e1B8WYgfMHlciHHPIanUTgBvyF8BZ3ev',NULL,'2025-09-26T20:33:00.565Z','2025-09-25 20:33:00','2025-09-25 20:33:00',NULL);
INSERT INTO sessions VALUES('sess_cVTBl1e5JJrINSdb57QPX8Li1o6nx28K','user_YPs3OShh06Jq3','{"id":"user_YPs3OShh06Jq3","name":"adnanaslam4e","email":"adnanaslam475@gmail.com","image":"https://ui-avatars.com/api/?name=adnan%20aslam&background=535961&color=fff&format=png"}',NULL,'odDwnF7D_kkLN72kiH822d73E5ebZViRhuVaqYZJb1s','2025-09-26T20:33:56.068Z','2025-09-25 20:33:05','2025-09-25 20:33:56',NULL);
INSERT INTO sessions VALUES('sess_oyXH33HXqHwnbGOb51OTGnzFWzrHSwYg','user_5CRN6YoyY23Or','{"id":"user_5CRN6YoyY23Or","name":"bananarblx","email":"yoof2289@gmail.com","image":"https://assets.whop.com/uploads/2025-07-03/user_13413064_00e550fa-758b-4dba-97f1-dbb7c35e6208.jpeg"}',NULL,'J5wa2Hf5QQg9c01Eh4nLQMjfC3t4p6qCjyijdpM9TA0','2025-09-26T20:36:52.312Z','2025-09-25 20:36:46','2025-09-25 20:36:52',NULL);
INSERT INTO sessions VALUES('sess_MponHssNJWuoHYnjs18JwxtXp8QrBKH6','user_vTPMJxL2bZWEN','{"id":"user_vTPMJxL2bZWEN","name":"countybarrell","email":"griddellbusiness@gmail.com","image":"https://img-v2-prod.whop.com/fHNd6gPt0uxzzuCraLybScyM0ri7do79nZ7V_cwJbQA/resize:fill/width:80/height:80/enlarge:true/dpr:2/plain/https://content.whop.com/default_avatars/bank.png"}',NULL,'sS-RMRbJdZOB9SE8anKWOaf_iXTZ0b9vTlXyPIM-9hU','2025-09-27T01:56:12.898Z','2025-09-25 23:23:31','2025-09-26 01:56:12',NULL);
INSERT INTO sessions VALUES('sess_oUjnBJkO5DSiwhAu8G9uLh10iHs6qMyR','user_qk35II5bsJbmN','{"id":"user_qk35II5bsJbmN","name":"griffintuttl3","email":"griffintuttl3@gmail.com","image":"https://cdn.discordapp.com/avatars/1281446049650704397/78c73003fa0e1a1b3301e7888dd72b64"}',NULL,'CkVmPeixNqmSPqGE9aLK7UU08tG0qHD2LW4zyajKz6E','2025-09-27T01:43:33.642Z','2025-09-26 01:43:26','2025-09-26 01:43:33',NULL);
INSERT INTO sessions VALUES('sess_LuOKwoYimK66JYewMzXG2YcxJHNQDe3S','','{}','TIcGYr0qoaR1zAm3Cg8F0R9wcxsILhl5',NULL,'2025-09-27T01:43:58.128Z','2025-09-26 01:43:58','2025-09-26 01:43:58',NULL);
INSERT INTO sessions VALUES('sess_M8IhqP7erFi9hDaQRoLVKtSE7Nsodcfz','user_UQCULZXhKDhZ1','{"id":"user_UQCULZXhKDhZ1","name":"symmetricggs","email":"symmetricggs@gmail.com","image":"https://cdn.discordapp.com/avatars/1029870780613398568/a_56c1f6f87a1e23cb5581bfc43e5bdba5"}',NULL,'6ZchmUIax6N0euvOL_cOiY9PU6j0sUuo5Oth8JmEloQ','2025-09-27T01:44:31.442Z','2025-09-26 01:44:01','2025-09-26 01:44:31',NULL);
INSERT INTO sessions VALUES('sess_5VAdkdpktg2hWksSVXJmhyq3FMMsMnHu','user_uiK5atQTklVBy','{"id":"user_uiK5atQTklVBy","name":"wifiincome","email":"elijahkigozi.business@gmail.com","image":"https://ui-avatars.com/api/?name=Elijah%20Kigozi&background=535961&color=fff&format=png"}',NULL,'aLjDToyiOwq5EM3BJUHe_oBwHujuMNT7BMGL-rFmxkk','2025-09-27T02:08:24.455Z','2025-09-26 02:07:59','2025-09-26 02:08:24',NULL);
INSERT INTO sessions VALUES('sess_O6nnJfZKk50ZQyKHNAp7Jf8Kr2rcEQGz','','{}','foxOrEWwewRIOAf3H8M3FavNm1qmwJPS',NULL,'2025-09-27T02:59:21.513Z','2025-09-26 02:59:21','2025-09-26 02:59:21',NULL);
INSERT INTO sessions VALUES('sess_YonLh7foHz49dh2miML55Zs4hVOx6yKg','user_Is8LpKs7vQHX2','{"id":"user_Is8LpKs7vQHX2","name":"mutualfeint1d9e","email":"sgtdanny96@gmail.com","image":"https://ui-avatars.com/api/?name=zesty821&background=535961&color=fff&format=png"}',NULL,'f_WEHl4sLIE1_nlx4s5KAi28cX4BjIP29YCp-UtiLnQ','2025-09-27T03:53:39.615Z','2025-09-26 02:59:22','2025-09-26 03:53:39',NULL);
INSERT INTO sessions VALUES('sess_MwvST6C8NHuNJxwdrFEo2OfOyKuvo2el','user_OpEqRecFFPWDm','{"id":"user_OpEqRecFFPWDm","name":"asleymoo","email":"ashleyfmui@gmail.com","image":"https://cdn.discordapp.com/avatars/710225143615455332/d9327d9149bafaddd6e1925902dd2c7a"}',NULL,'f1al1Y8gArZYaYv7lsZizOjBA3jFwTft_vZrmBX0ffA','2025-09-27T03:30:35.214Z','2025-09-26 03:30:31','2025-09-26 03:30:35',NULL);
INSERT INTO sessions VALUES('sess_4RM4PLKT7SSjawDylaDQ4g5dcUJYwgcS','','{}','UG6I2YnDBS6HocUYGTC9nguS6mexsuZz',NULL,'2025-09-27T04:04:31.139Z','2025-09-26 04:04:31','2025-09-26 04:04:31',NULL);
INSERT INTO sessions VALUES('sess_5IHdDyOI0nRZ3znfUtraxfpq3xgNJ0HV','','{}','0k3qEOwbaLVqQVaoNVkGi5FkReyaEems',NULL,'2025-09-27T05:59:12.126Z','2025-09-26 05:59:12','2025-09-26 05:59:12',NULL);
INSERT INTO sessions VALUES('sess_s0Df0ZWRQcPC2smT8doKemkpJZ8Llmn5','user_ZnHUlDNVOnsaZ','{"id":"user_ZnHUlDNVOnsaZ","name":"ionicwin","email":"manallobryan@gmail.com","image":"https://ui-avatars.com/api/?name=ionicwin&background=535961&color=fff&format=png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_ZnHUlDNVOnsaZ","originalEmail":"manallobryan@gmail.com","startedAt":"2025-09-26T07:24:35.834Z"}}',NULL,'9WpPs41T4dkRndHVw4e3c7jQdoACLf48JFfwBJQ4mvs','2025-09-27T07:24:18.234Z','2025-09-26 07:23:50','2025-09-26 07:24:35',NULL);
INSERT INTO sessions VALUES('sess_yGYW2JIpKKs8o4LvaK5zRxP2c99utnFE','user_ML5kJaeHikfZi','{"id":"user_ML5kJaeHikfZi","name":"villarazajestoni","email":"villaraza.jestoni24@gmail.com","image":"https://ui-avatars.com/api/?name=villarazajestoni&background=535961&color=fff&format=png","virtualAssistantMode":{"targetUserId":"user_uZ1HxkxpdULMs","originalUserId":"user_ML5kJaeHikfZi","originalEmail":"villaraza.jestoni24@gmail.com","startedAt":"2025-09-26T10:21:39.494Z"}}',NULL,'ACtVJHkLej3Foie733pHU1DC1dXAOjFhYO8ZqHvYnwg','2025-09-27T10:18:48.752Z','2025-09-26 10:17:59','2025-09-26 10:21:39',NULL);
INSERT INTO sessions VALUES('sess_SHyBJJYuSoDungYFeuGAp1H6Pvc7EhlS','','{}','ZJ5yZN0H6OlayuoT2030Sxs1HmRlArbH',NULL,'2025-09-27T11:28:18.342Z','2025-09-26 11:28:18','2025-09-26 11:28:18',NULL);
INSERT INTO sessions VALUES('sess_Udf0nm5jKJn4rxJG72OXt0G6QRMr6Dg7','user_gRsZMHjGiKVM5','{"id":"user_gRsZMHjGiKVM5","name":"user14b51712796","email":"carson.craig4@icloud.com","image":"https://cdn.discordapp.com/avatars/316444019930693634/67b312f961c29374cc9a75a05607de76"}',NULL,'QQ-OKHn3mqVWErkvLUxFUo8f6kwuQU-Fpvozl1xXxnw','2025-09-27T11:28:44.626Z','2025-09-26 11:28:19','2025-09-26 11:28:44',NULL);
CREATE TABLE teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
INSERT INTO teams VALUES('team_1752056042197_q0mwp50t5','M E',NULL,'user_wVUCbtEuyXgEC','user_wVUCbtEuyXgEC','2025-07-09 10:14:02','2025-07-09 10:14:02');
CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );
INSERT INTO team_members VALUES('member_1752056042622_1p0o6uw2a','team_1752056042197_q0mwp50t5','user_wVUCbtEuyXgEC','vl@black.com','vlb8','owner','2025-07-09 10:14:02');
INSERT INTO team_members VALUES('member_1752056043220_sfoau16xl','team_1752056042197_q0mwp50t5','user_uZ1HxkxpdULMs','cranapplellc@gmail.com','maxtl12','member','2025-07-09 10:14:03');
INSERT INTO team_members VALUES('member_1753455186673_70xcx4s5b','team_1752056042197_q0mwp50t5','user_rs8F3iJo5DKoh','rafhaelgaveriaiv@gmail.com','raphslick','member','2025-07-25 14:53:06');
INSERT INTO team_members VALUES('member_1755316214656_1ar8hyzl3','team_1752056042197_q0mwp50t5','user_7vMF2GI5Dz3YT','justin.m.lee.dev@gmail.com','justin-m-lee-dev','member','2025-08-16 03:50:14');
INSERT INTO team_members VALUES('member_1756528766401_j8wz4nhsj','team_1752056042197_q0mwp50t5','user_0zZYR31XAbMO1','alexuvaro00@gmail.com','alexuvaro00','member','2025-08-30 04:39:26');
CREATE TABLE virtual_assistants (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      , has_comment_bot_access BOOLEAN DEFAULT 1, has_dashboard_access BOOLEAN DEFAULT 1, has_bc_gen_access BOOLEAN DEFAULT 1, dashboard_metrics BOOLEAN DEFAULT 0, dashboard_campaigns BOOLEAN DEFAULT 1, dashboard_sparks BOOLEAN DEFAULT 1, dashboard_templates BOOLEAN DEFAULT 1, dashboard_shopify BOOLEAN DEFAULT 1, dashboard_logs BOOLEAN DEFAULT 0, dashboard_link_splitter BOOLEAN DEFAULT 1, dashboard_launches BOOLEAN DEFAULT 1);
INSERT INTO virtual_assistants VALUES('rCDydqRgvizL979NxeauIjYIPOyFPjeamBl1','user_7vMF2GI5Dz3YT','jlrockfish13@gmail.com','active','2025-09-01T15:30:01.447Z','2025-10-01T15:30:01.447Z',1,1,1,0,1,1,0,0,0,0,1);
INSERT INTO virtual_assistants VALUES('aiJjrH581z74JCXRxxhMkrSYRQIvSKYDlEQR','user_uZ1HxkxpdULMs','cuharty@gmail.com','active','2025-09-07T01:40:53.450Z','2025-11-06T01:40:53.450Z',1,1,1,0,1,1,1,1,0,1,1);
INSERT INTO virtual_assistants VALUES('IdT4FxmqkAax7jq6TQZMa7vAQb4Q2Kr4ekG9','user_uZ1HxkxpdULMs','rafhaelgaveriaiv@gmail.com','active','2025-09-10T20:13:48.256Z','2025-10-10T20:13:48.256Z',1,1,1,0,1,1,0,1,0,0,1);
INSERT INTO virtual_assistants VALUES('RaKkKtm9muOApU4tAyEaHT5Oyu9EGMRraglF','user_uZ1HxkxpdULMs','markadvert0@gmail.com','active','2025-09-11T06:55:23.712Z','2025-10-11T06:55:23.712Z',1,1,0,0,0,1,0,0,0,0,0);
INSERT INTO virtual_assistants VALUES('CVqFyhfM4ML5kvXtmXZ66tRWlLrVOVkt31q1','user_uZ1HxkxpdULMs','jepnted25@gmail.com','active','2025-09-11T19:21:26.531Z','2025-10-11T19:21:26.531Z',1,1,1,0,1,1,0,1,0,0,1);
INSERT INTO virtual_assistants VALUES('Ca3LaLj7Uhqv8pi4ZFrLrG77iegzzL2h2I2f','user_uZ1HxkxpdULMs','carson.craig4@icloud.com','active','2025-09-22T21:27:10.881Z','2025-10-22T21:27:10.881Z',1,1,1,0,1,1,1,1,0,1,1);
INSERT INTO virtual_assistants VALUES('ygYKJZoEXXKT4VN2JBo4u5bltOMhasSvuaf4','user_uZ1HxkxpdULMs','manallobryan@gmail.com','active','2025-09-23T06:33:39.607Z','2025-11-22T06:33:39.607Z',1,1,1,0,1,1,1,1,0,0,1);
INSERT INTO virtual_assistants VALUES('SHfIrPLj5gn31fi09lgaT6JGHMXmdBbVScAO','user_uZ1HxkxpdULMs','villaraza.jestoni24@gmail.com','active','2025-09-23T06:33:50.192Z','2025-10-23T06:33:50.192Z',1,1,1,0,1,1,1,1,0,0,1);
CREATE INDEX idx_sessions_expires_at 
      ON sessions(expires_at)
    ;
CREATE INDEX idx_sessions_user_id 
      ON sessions(user_id)
    ;
CREATE INDEX idx_sessions_created_at 
      ON sessions(created_at)
    ;
CREATE INDEX idx_team_members_team_id 
      ON team_members(team_id)
    ;
CREATE INDEX idx_team_members_user_id 
      ON team_members(user_id)
    ;
CREATE INDEX idx_virtual_assistants_user_id 
      ON virtual_assistants(user_id)
    ;
CREATE INDEX idx_virtual_assistants_expires_at 
      ON virtual_assistants(expires_at)
    ;
