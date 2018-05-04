import client from '../api-client.js'

suite('client base', () => {
  test('client throws if no settings', () => {
    try {
      client()
    } catch(e) { 
      assert.equal(e.message, "settings are needed eg. client({defaultUrl:'./fakeApi'})");
    }
  });
  test('client throws if settings but no default url' , () => {
    try {
      client({})
    } catch(e) { 
      assert.equal(e.message, "defaultUrl is needed eg. client({defaultUrl:'./fakeApi'})");
    }
  });
  test("client loads if client({defaultUrl:'./fakeApi'})" , () => {
    var API = client({
      defaultUrl:'./fakeApi'
    })
    assert.ok(API) 
  });
  test("make sure there is no user logged in yet" , () => {
    var API = client({
      defaultUrl:'./fakeApi'
    })
    assert.equal(API.isLoggedIn, false) 
  });
  test("has username been not taken", () => {
    var API = client({
      defaultUrl:'./fakeApi',
      getDataFromServer: () => {
        return new Promise((resolve) => {
          resolve({data:"false"})
        })
      },
    })
    var query = "users.marcus7778"
    API.check(query).then((exists) => {
      assert.equal(exists, false)
    })
  })
  test("has username been taken", () => {
    var API = client({
      defaultUrl:'./fakeApi',
      getDataFromServer: () => {
        return new Promise((resolve) => {
          resolve({data:"true"})
        })
      },
    })
    var query = "users.marcus7777"
    API.check(query).then((exists) => {
      assert.equal(exists, true)
    })
  })
  test("forgotUsername for a no email", () => {
    var API = client({
      defaultUrl:'./fakeApi',
    })
    try {
      API.forgotUsername({
        params: {
          user: {
          }
        }      
      })
    } catch (e) {
      assert.equal(e.message, "need a params.user.email in the Object") 
    }
  })
  test("forgotUsername for a valid email", () => {
    var API = client({
      defaultUrl:'./fakeApi',
      poster: function() {
        return new Promise(function(resolve, reject) { 
          resolve({
            data: "true"
          })
        })
      }
    })
    API.forgotUsername({
      params: {
        user: {
          email: "marcus@hhost.me"
        }
      }      
    }).then((ok) => {
      assert.ok(ok) 
        
    })
  })
  test("forgotUsername for a invalid email", () => {
    var API = client({
      defaultUrl:'./fakeApi/',
    })
    try {
      API.forgotUsername({
        params: {
          user: {
            email: "1234567890f7ypfy873pf1234567891234567.com"
          }
        }      
      })
    } catch(e) {
      assert.equal(e.message,"invalid email") 
    }
  })
  test("forgotPassword for a no username", () => {
    var API = client({
      defaultUrl:'./fakeApi'
    })
    try {
      API.forgotPassword({
        params: {
          user: {
          }
        }      
      })
    } catch(e) {
      assert.equal(e.message, "need a params.user.username in the Object") 
    }
  })
  test("forgotPassword for a valid username", () => {
    var API = client({
      defaultUrl:'./fakeApi',
      poster: function() {
        return new Promise(function(resolve, reject) { 
          resolve({
            data:"true"
          })
        })
      }
    })
    API.forgotPassword({
      params: {
        user: {
          username: "marcus7777"
        }
      }      
    }).then((ok) => {
      assert.ok(ok)
    })
  })
  test("forgotPassword for a invalid username", () => {
    var API = client({
      defaultUrl:'./fakeApi/',
      poster: function() {
        return new Promise(function(resolve, reject) { 
          reject()
        })
      }
    })
    try {
      API.forgotPassword({
        params: {
          user: {
            username: "..."
          }
        }      
      }).then(() => {
        assert.equal(1,0) 
      })
    } catch(e) {
      assert.equal(e.message,"invalid username") 
    }
  })
})
suite('client user', () => {
  var name = "test" + (Math.random()+"").replace(".","")
  var password = "342340bab5uxexeuee4"

  test("can a user be created",() => {
    localStorage.clear()
    var API = client({
      defaultUrl:'./fakeApi/',
      poster: function() {
        return new Promise(function(resolve) { 
          resolve(JSON.parse(`{"data":{"duration":"57600000","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1ODI4NjU3OTUuMTA1LCJ1c2VyIjp7ImlkIjoiNWFlOWI1ODJhODJkOWYyNmVjNmVhMmVhIiwicm9sZXMiOltdfX0.0HwbZkelvGFAxX51ihNeNFRqh79xti_jOmn_EyYNsGU","user":{"id":"5ae9b582a82d9f26ec6ea2ea","roles":[],"modified":"2018-05-02T12:56:35.075266"}},"path":"/users/5ae9b582a82d9f26ec6ea2ea"}`)
          )
        })
      }
    })
    return API.create({
      params: {
        user: {
          username: name,
          email: "marcus@kano.me",
          password,
        }
      },
      populate:{
        id:"user.id"
      }
    }).then( async (user) => {
      assert.equal(await user.id, "5ae9b582a82d9f26ec6ea2ea") 
    })
  })
  test("user is logged in",() => {
    localStorage.clear()
    var API = client({
      defaultUrl:'./fakeApi/',
      poster: () => {
        return new Promise((resolve) => {
          resolve(JSON.parse(`{"data":{"duration":"57600000","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1ODI4NjU3OTUuMTA1LCJ1c2VyIjp7ImlkIjoiNWFlOWI1ODJhODJkOWYyNmVjNmVhMmVhIiwicm9sZXMiOltdfX0.0HwbZkelvGFAxX51ihNeNFRqh79xti_jOmn_EyYNsGU","user":{"id":"5ae9b582a82d9f26ec6ea2ea","roles":[],"modified":"2018-05-02T12:56:35.075266"}},"path":"/users/5ae9b582a82d9f26ec6ea2ea"}`))
        })
      },
      getDataFromServer: () => {
        return new Promise((resolve) => {
          resolve(JSON.parse(`{"data":{"duration":"57600000","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1ODI4NjU3OTUuMTA1LCJ1c2VyIjp7ImlkIjoiNWFlOWI1ODJhODJkOWYyNmVjNmVhMmVhIiwicm9sZXMiOltdfX0.0HwbZkelvGFAxX51ihNeNFRqh79xti_jOmn_EyYNsGU","user":{"id":"5ae9b582a82d9f26ec6ea2ea","roles":[],"modified":"2018-05-02T12:56:35.075266"}},"path":"/users/5ae9b582a82d9f26ec6ea2ea"}`))
        })
      },
    })
    return API.login({
      params: {
        user: {
          username: name,
          password,
        }
      }    
    }).then(() => {
      assert.equal(API.isLoggedIn, name)
    })
  })
  test("user is logged in and out",() => {
    localStorage.clear()
    var API = client({
      defaultUrl:'./fakeApi/',
      poster: () => {
        return new Promise((resolve) => {
          resolve(JSON.parse(`{"data":{"duration":"57600000","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1ODI4NjU3OTUuMTA1LCJ1c2VyIjp7ImlkIjoiNWFlOWI1ODJhODJkOWYyNmVjNmVhMmVhIiwicm9sZXMiOltdfX0.0HwbZkelvGFAxX51ihNeNFRqh79xti_jOmn_EyYNsGU","user":{"id":"5ae9b582a82d9f26ec6ea2ea","roles":[],"modified":"2018-05-02T12:56:35.075266"}},"path":"/users/5ae9b582a82d9f26ec6ea2ea"}`))
        })
      },
      getDataFromServer: () => {
        return new Promise((resolve) => {
          resolve(JSON.parse(`{"data":{"duration":"57600000","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1ODI4NjU3OTUuMTA1LCJ1c2VyIjp7ImlkIjoiNWFlOWI1ODJhODJkOWYyNmVjNmVhMmVhIiwicm9sZXMiOltdfX0.0HwbZkelvGFAxX51ihNeNFRqh79xti_jOmn_EyYNsGU","user":{"id":"5ae9b582a82d9f26ec6ea2ea","roles":[],"modified":"2018-05-02T12:56:35.075266"}},"path":"/users/5ae9b582a82d9f26ec6ea2ea"}`))
        })
      },
    })
    return API.login({
      params: {
        user: {
          username: name,
          password,
        }
      }    
    }).then(() => {
      return API.logout()
    }).then(() => {
      assert.ok(localStorage.getItem("47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="), "not save encryptString")
      return assert.equal(API.isLoggedIn, false)
    })
  })

});
