import '/bower_components/gun/gun.js'
export default function (settings) {
  if (!settings) throw new Error('settings are needed eg. client({defaultUrl:\'./fakeApi\'})')
  if (!settings.defaultUrl) throw new Error('defaultUrl is needed eg. client({defaultUrl:\'./fakeApi\'})')
  const initialStateLoggedInUser = localStorage.getItem('user')
  let initialStateUser = false
  if (initialStateLoggedInUser) {
    initialStateUser = initialStateLoggedInUser.username
  }
  const stackOfXhr = {}
  // libraries
  const gun = Gun()
  // functions
  function ifArray (data) {
    if (typeof data === 'object' && Object.keys(data).length && '0123456789'.startsWith(Object.keys(data).join('').slice(0, -1))) {
      return Object.keys(data).reduce((a, v) => {
        if (v !== '_' && v === +v) {
          a.push(v)
        }
        return a
      }, []).map((value) => {
        return data[value]
      })
    }
    return data
  }
  function getDataFromServer (path) {
    return new Promise((resolve, reject) => {
      if (stackOfXhr[path]) {
        stackOfXhr[path].push(resolve)
      } else {
        stackOfXhr[path] = [resolve]
        if (!navigator.onLine) {
          reject(new Error('offline'))
        }
        getter('user._accessToken').then((accessToken) => {
          let theFetch = {
            headers: {
              'content-type': 'application/json',
              Accept: 'application/json'
            },
            method: 'GET',
            mode: 'cors',
            redirect: 'follow',
            referrer: 'Api-client'
          }
          if (accessToken) {
            theFetch.headers.authorization = `Bearer ${accessToken}`
          }
          fetch(settings.defaultUrl + "/" + path, theFetch).then((response) => {
            return response.json()
          }).then(dataFromServer => {
            if (dataFromServer !== undefined && dataFromServer !== null) {
              stackOfXhr[path].forEach((resolved) => {
                resolved(dataFromServer)
              })
              delete (stackOfXhr[path])
            } else {
              reject(new Error('No Response'))
            }
          })
          if (settings.log) { console.log('get', path) }
        })
      }
    })
  }
  if (settings.getDataFromServer) {
    getDataFromServer = settings.getDataFromServer
  }
  function getter (query, params, sync) {
    return new Promise((resolve, reject) => {
      const loggedInUser = JSON.parse(localStorage.getItem('user'))
      let queryRun = query
      if (loggedInUser) {
        if (query === 'user._accessToken') {
          resolve(loggedInUser._accessToken)
          return
        } else if (query === 'user.username') {
          resolve(loggedInUser.username)
          return
        } else if (query === 'user._localToken') {
          resolve(loggedInUser._localToken)
          return
        } else if (query.startsWith('user.') || query === 'user') {
          queryRun = query.replace('user', loggedInUser.mapTo)
        }
      } else if (query.startsWith('user.')) {
        resolve(undefined)
        return
      }
      queryRun.split('.*')[0].split('.').reduce((db, val) => { // TODO use "gun load"  if ".*"
        return db.get(val)
      }, gun).once((data) => {
        if (sync && data === undefined) {
          let gunData = data
          if (query.startsWith('users.')) {
            const username = query.split('.')[1]
            const user = gun.get('users').get(query.split('.')[1])
            if (params === 'check' && query.split('.').length === 2) {
              getDataFromServer(`accounts/checkUsernameExists/${username}`).then((serverRes) => {
                const theData = JSON.parse(serverRes.data)
                resolve(theData)
                if (theData) {
                  user.set({})
                }
              })
            } else {
              getDataFromServer(`/users/?username=${query.split('.')[1]}`).then((serverRes) => {
                const serverData = JSON.parse(serverRes, (key, value) => {
                  let theValue = value
                  if (Array.isArray(value)) {
                    theValue = value.reduce((acc, curValue, curIndex) => {
                      acc[curIndex] = curValue
                      return acc
                    }, {})
                  }
                  return theValue
                })
                Object.keys(serverData.data).forEach((key) => {
                  user.get(key.replace('_', '')).put(serverData.data[key])
                })
              }).then(() => {
                query.split('.').reduce((db, val) => {
                  return db.get(val)
                }, gun).once((retry) => {
                  gunData = retry
                })
              }).then(() => {
                resolve(ifArray(gunData))
              })
                .catch((e) => {
                  reject(e)
                })
            }
          }
        } else {
          resolve(ifArray(data))
        }
      })
    })
  }
  function arraysToObject (valueToSet) {
    return JSON.parse(JSON.stringify(valueToSet, (_, value) => {
      if (Array.isArray(value)) {
        return value.reduce((accumulator, currentValue, currentIndex) => {
          const theAccumulator = accumulator
          theAccumulator[currentIndex] = currentValue
          return theAccumulator
        }, {})
      }
      return value
    }))
  }
  function setter (query, valueToSet) {
    const loggedInUser = JSON.parse(localStorage.getItem('user'))
    let theQuery = query
    if (loggedInUser) {
      if (query.startsWith('user.') || query === 'user') {
        theQuery = query.replace('user', loggedInUser.mapTo)
      }
    }

    let oldValue
    let newValue
    return getter(theQuery).then((data) => {
      oldValue = data
    }).then(() => {
      theQuery.split('.').reduce((db, val) => {
        return db.get(val)
      }, gun).put(arraysToObject(valueToSet))
    }).then(() => {
      return getter(theQuery)
    }).then((data) => {
      newValue = data
    }).then(() => {
      if (oldValue !== undefined || JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        if (settings.log) { console.log('needs sync', newValue) }
        // TODO add to postList
      }
    }).then(() => {
      return newValue
    })
  }
  function onIdle (itime, doAfter) {
    return new Promise((resolve) => {
      let trys = 0
      const onIdleTest = () => {
        const t = performance.now()
        setTimeout(() => {
          trys += 1
          if (doAfter && trys > doAfter) {
            resolve()
          }
          if (Math.round(performance.now() - t) === Math.round(itime)) {
            resolve()
          } else {
            onIdleTest()
          }
        }, itime)
      }
      onIdleTest()
    })
  }
  function renewToken () {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user.renew < Date.now() && user._accessToken) {
      onIdle(1000, 10).then(() => {
        return getDataFromServer('accounts/auth/refresh').then((res) => {
          if (settings.log) { console.log(res) }
          // duration
          // user
          if (res.data && res.data.token) {
            const token = res.data.token
            const duration = res.data.duration
            const renew = Date.now() + ((duration / 2) * 1000)
            const lUser = localStorage.user
            localStorage.setItem(
              'user',
              JSON.stringify(Object.assign(lUser, {
                _accessToken: token,
                renew
              }))
            )
          } else {
            throw new Error('no new token')
          }
        })
      })
    }
  }
  function poster (data, path, accessToken) {
    if (!navigator.onLine) {
      throw new Error('offline')
    }
    const url = settings.defaultUrl + path
    const theFetch = {
      body: JSON.stringify(data), // must match 'Content-Type' header
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json'
      },
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      referrer: 'no-referrer'
    }
    if (accessToken) {
      theFetch.headers.authorization = `Bearer ${accessToken}`
    }
    return fetch(url, theFetch).then((response) => {
      return response.json().then((theData) => {
        if (response.status < 300) {
          renewToken()
          return theData
        }
        throw new Error('no post')
      })
    })
  }
  if (settings.poster) {
    poster = settings.poster
  }
  function sha256 (str) {
    // We transform the string into an arraybuffer.
    const buffer = new TextEncoder('utf-8').encode(str)
    return crypto.subtle.digest('SHA-256', buffer).then((hash) => {
      return hash
    })
  }
  function ab2str (buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf))
  }
  function str2ab (str) {
    const buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
    const bufView = new Uint16Array(buf)
    for (let i = 0, strLen = str.length; i < strLen; i += 1) {
      bufView[i] = str.charCodeAt(i)
    }
    return buf
  }
  function arrayToBase64 (ab) {
    const dView = new Uint8Array(ab) // Get a byte view
    const arr = Array.prototype.slice.call(dView) // Create a normal array
    const arr1 = arr.map((item) => {
      return String.fromCharCode(item) // Convert
    })
    return window.btoa(arr1.join('')) // Form a string
  }
  function base64ToArrayBuffer (s) {
    const asciiString = window.atob(s)
    return new Uint8Array([...asciiString].map((char) => { return char.charCodeAt(0) }))
  }
  function keyFromLocalToken (localToken) {
    return window.crypto.subtle.importKey('jwk', {
      kty: 'oct', k: localToken, alg: 'A256CBC', ext: true
    }, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
  }
  function encryptString (localToken, data) {
    return keyFromLocalToken(localToken).then((key) => {
      const iv = window.crypto.getRandomValues(new Uint8Array(16))
      return window.crypto.subtle.encrypt({
        name: 'AES-CBC',
        iv
      }, key, str2ab(`12345678${data}`)) // add 8 chr due to droppinginitial vector
    }).then((encrypted) => {
      return ab2str(encrypted)
    })
  }
  function decryptString (localToken, data) {
    return keyFromLocalToken(localToken).then((key) => {
      return window.crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: window.crypto.getRandomValues(new Uint8Array(16))
        },
        key, // from generateKey or importKey above
        str2ab(data)
      )
    }).then((decrypted) => {
      return ab2str(decrypted).slice(8)
    })
  }
  function makeLocalToken (username, password) {
    return sha256(username + password).then((localhash) => {
      return crypto.subtle.importKey('raw', localhash, { name: 'AES-CBC' }, true, ['encrypt', 'decrypt'])
    }).then((key) => {
      return sha256(username).then((userSHA) => {
        const data = localStorage.getItem(arrayToBase64(userSHA))
        if (data) {
          localStorage.removeItem(arrayToBase64(userSHA))
          window.crypto.subtle.decrypt(
            {
              name: 'AES-CBC',
              iv: window.crypto.getRandomValues(new Uint8Array(16))
            },
            key, // from generateKey or importKey above
            str2ab(data) // ArrayBuffer of the data
          ).then((decrypted) => {
            // TODO put ES-CBC
            // as no initial Factor I need to chop off the first 8 characters
            localStorage.setItem('user', ab2str(decrypted).slice(8))
          }).catch((err) => {
            console.error(err)
          })
        }
        return key
      }).then((theKey) => {
        // if encrypted data decrypt it
        return crypto.subtle.exportKey('jwk', theKey)
      }).then((keydata) => {
        // returns the exported key data
        return keydata.k // save the hard bit
      })
    })
  }
  var API = {
    isLoggedIn: false,
    check: (query) => {
      return getter(query, 'check', true).then((data) => { return !!data })
    },
    forgotUsername: (args) => {
      if (args && args.params && args.params.user && args.params.user.email) {
        var email = args.params.user.email
        if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi.test(email)) {
          return poster(email , 'accounts/forgotUsername' ).then((response) => {
            if (response.data === 'true') {
              return API.read(args)
            } else {
              throw new Error('invalid email')
            }
          })
        } else {
          throw new Error('invalid email')
        }
      } else {
        throw new Error('need a params.user.email in the Object')
      }
    },
    forgotPassword: (args) => {
      if (args && args.params && args.params.user && args.params.user.username) {
        var username = args.params.user.username
        if (/^[0-9a-z]*$/gi.test(username)) {
          return poster(username, 'accounts/forgotPassword' ).then((response) => {
            if (response.data === 'true') {
              return API.read(args)
            } else {
              throw new Error('invalid username')
            }
          })
        } else {
          throw new Error('invalid username')
        }
      } else {
        throw new Error('need a params.user.username in the Object')
      }
    },
    create: (args) => {
      const loggedInUser = localStorage.getItem('user')
      if (args.params.user && !loggedInUser) {
        const argUser = args.params.user
        if (argUser.username && argUser.password && argUser.email) {
          if (!argUser.erole) { argUser.erole = 'notset' }
          //  if (!args.params.user.epurpose) {args.params.user.epurpose = "notset"}
          return poster(argUser, 'accounts').then((res) => {
            if (settings.log) { console.log(res) }
            // duration
            // user
            if (res.data && res.data.token) {
              const token = res.data.token
              const duration = res.data.duration
              const renew = Date.now() + ((duration / 2) * 1000)
              const user = Object.assign(
                { username: args.params.user.username },
                res.data.user
              )

              if (user.username) {
                API.isLoggedIn = args.params.user.username

                return makeLocalToken(
                  user.username,
                  user.password
                ).then((localToken) => {
                  return sha256(user.username).then((hash) => {
                    const userHash = arrayToBase64(hash)
                    return localStorage.setItem(
                      'user',
                      JSON.stringify(Object.assign(localStorage.user, {
                        renew,
                        userHash,
                        _accessToken: token,
                        _localToken: localToken,
                        username: user.username
                      }))
                    )
                  })
                }).then(() => {
                  return API.update(Object.assign(args, {
                    params: user
                  }))
                })
              }
            }
            throw res
          }).catch((err) => {
            console.error('error create user', err)
          })
        }
      }
    },
    read: (args) => {
      return API._read(Object.assign({ sync: true }, args))
    },
    _read: (args) => {
      if (args.populate) {
        const allThePromises = []
        const allThePromisesKeys = []
        const bulid = JSON.parse(JSON.stringify(args.populate), (_, value) => {
          if (typeof value === 'string' && /^[_a-z0-9\-.]*$/i.test(value)) {
            if (settings.resolve) {
              allThePromisesKeys.push(value)
              allThePromises.push(getter(value, args.params, args.sync))
              return value
            }
            return getter(value, args.params, args.sync)
          }
          return value
        })
        if (settings.resolve) {
          return Promise.all(allThePromises).then((values) => {
            return JSON.parse(JSON.stringify(args.populate), (_, value) => {
              if (typeof value === 'string' && /^[_a-z0-9\-.]*$/i.test(value)) {
                return values[allThePromisesKeys.indexOf(value)]
              }
              return value
            })
          })
        }
        return bulid
      } else {
        return {}
      }
    }

  }
  return API
}