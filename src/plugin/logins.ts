import fs from 'fs-extra'
import Authenticator, { RegisterAuthenticator, Profile, SkinChangeable } from './Authenticator'
import { genUUID, fetchJson, appDir } from '../util'
import { join } from 'path'

const BASE_URL = 'https://authserver.mojang.com/'
const saveFile = () => {
  try {
    __profilesModel().saveLaunchProfileJsonSync()
  } catch (e) {
    console.error(e)
    throw new Error('保存失败!')
  }
}

export const YGGDRASIL = 'yggdrasil'
@RegisterAuthenticator(YGGDRASIL, () => $('Online Login'), require('../assets/images/steve.png'), [
  {
    name: 'email',
    title: () => $('Email'),
    inputProps: { type: 'email', required: true }
  },
  {
    name: 'password',
    title: () => $('Password'),
    inputProps: { type: 'password', required: true }
  }
], { name: () => $('Register'), url: () => 'https://my.minecraft.net/store/minecraft/#register' })
export class Yggdrasil extends Authenticator implements SkinChangeable {
  public async login (options: { email: string, password: string }) {
    const m = __profilesModel()
    const p = Object.values(m.authenticationDatabase)
    if (p.find(it => it.username.toLowerCase() === options.password.toLowerCase())) {
      throw new Error($('You have already logged in with this account!'))
    }
    const data = await fetchJson(BASE_URL + 'authenticate', true, {
      agent: 'Minecraft',
      username: options.email,
      password: options.password,
      clientToken: m.clientToken,
      requestUser: true
    }).catch(e => {
      console.error(e)
      throw new Error($('Network connection failed!'))
    })
    if (!data || data.error) {
      console.error(data)
      throw new Error($('Network connection failed!'))
    }
    if (!data.selectedProfile || !data.selectedProfile.id) throw new Error($('You don\'t have an online profile yet!'))
    const sp = data.selectedProfile
    if (p.flatMap(it => Object.keys(it.profiles))
      .includes(sp.id)) throw new Error($('You have already logged in with this account!'))
    m.modify(n => {
      n.authenticationDatabase[data.user.id] = {
        properties: [],
        username: data.user.username,
        accessToken: data.accessToken,
        profiles: { [sp.id]: { displayName: sp.name } }
      }
      n.selectedUser.account = data.user.includes
      n.selectedUser.profile = sp.id
    })
    await saveFile()
    return data.user.id as string
  }
  public async logout (key: string) {
    const m = __profilesModel()
    const p = m.authenticationDatabase[key]
    if (!p) return
    const d = await fetchJson(BASE_URL + 'invalidate', true, { accessToken: p.accessToken, clientToken: m.clientToken })
      .catch(e => {
        console.error(e)
        throw new Error($('Network connection failed!'))
      })
    if (!d && d.error) {
      console.error(d)
      throw new Error($('Network connection failed!'))
    }
    m.modify(n => delete n.authenticationDatabase[key])
    await saveFile()
  }
  public async refresh (key: string) {
    const m = __profilesModel()
    const p = m.authenticationDatabase[key]
    if (!p) throw new Error($('Account does not exists!'))
    const d = await fetchJson(BASE_URL + 'refresh', true, {
      clientToken: m.clientToken, accessToken: p.accessToken, requestUser: true })
      .catch(e => {
        console.error(e)
        throw new Error($('Network connection failed!'))
      })
    if (!d || d.error) {
      console.error(d)
      throw new Error($('Network connection failed!'))
    }
    m.modify(n => {
      const p2 = n.authenticationDatabase[key]
      p2.accessToken = d.accessToken
      p2.username = d.user.username
      p2.profiles[d.selectedProfile.id].displayName = d.selectedProfile.name
    })
    await saveFile()
  }
  public async validate (key: string) {
    const m = __profilesModel()
    const p = m.authenticationDatabase[key]
    if (!p) throw new Error($('Account does not exists!'))
    const d = await fetchJson(BASE_URL + 'validate', true, { clientToken: m.clientToken, accessToken: p.accessToken })
      .catch(e => {
        console.error(e)
        throw new Error($('Network connection failed!'))
      })
    if (d && d.error) {
      console.error(d)
      m.modify(n => delete n.authenticationDatabase[key])
      await saveFile()
      return false
    }
    return true
  }
  public getData (key: string) {
    const m = __profilesModel()
    const p = m.authenticationDatabase[key]
    if (!p) throw new Error($('Account does not exists!'))
    const uuid = Object.keys(p.profiles)[0]
    if (!uuid) throw new Error($('Account does not exists!'))
    return {
      key,
      uuid,
      type: YGGDRASIL,
      displayName: p.username,
      clientToken: m.clientToken,
      accessToken: p.accessToken,
      username: p.profiles[uuid].displayName,
      skinUrl: 'https://minotar.net/skin/' + uuid
    }
  }
  public getAllProfiles () {
    const m = __profilesModel()
    const clientToken = m.clientToken
    return Object
      .entries(m.authenticationDatabase)
      .map(([key, it]) => {
        const uuid = Object.keys(it.profiles)[0]
        return uuid ? {
          key,
          uuid,
          clientToken,
          type: YGGDRASIL,
          displayName: it.username,
          accessToken: it.accessToken,
          username: it.profiles[uuid].displayName,
          skinUrl: 'https://minotar.net/skin/' + uuid
        } : null
      }).filter(Boolean)
  }
  public async changeSkin (key: string, path: string, slim: boolean = false) {
    const p = this.getData(key)
    const body = new FormData()
    if (slim) body.append('model', 'slim')
    body.append('file', new Blob([await fs.readFile(path)]))
    const text = await fetch(`https://api.mojang.com/user/profile/${p.uuid}/skin`, {
      body,
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + p.accessToken }
    }).then(it => it.text(), e => {
      console.error(e)
      throw new Error($('Network connection failed!'))
    })
    if (text) {
      console.error(JSON.parse(text))
      throw new Error($('Network connection failed!'))
    }
  }
}

export const OFFLINE = 'Offline'
@RegisterAuthenticator(OFFLINE, () => $('Offline Login'), require('../assets/images/zombie.png'), [
  {
    name: 'username',
    title: () => $('Username'),
    inputProps: { required: true, pattern: '\\w{2,16}' }
  }
])
export class Offline extends Authenticator {
  private db: { [key: string]: string } = fs.readJsonSync(join(appDir, 'offline.json'), { throws: false }) || { }
  public async login (options: { username: string }) {
    const id = genUUID('OfflinePlayer:' + options.username.toLowerCase())
    if (id in this.db) throw new Error($('Account already exists!'))
    this.db[id] = options.username
    await this.save()
    return id
  }
  public async logout (id: string) {
    delete this.db[id]
    await this.save()
  }
  public refresh (id: string) {
    this.check(id)
    return Promise.resolve()
  }
  public validate (id: string): Promise<boolean> {
    this.check(id)
    return Promise.resolve(true)
  }
  public getData (uuid: string): Profile {
    const username = this.db[uuid]
    if (!username) throw new Error($('Account does not exists!'))
    return {
      uuid,
      username,
      key: uuid,
      type: OFFLINE,
      clientToken: genUUID(),
      accessToken: genUUID(),
      skinUrl: 'https://minotar.net/skin/' + username
    }
  }
  public getAllProfiles (): Profile[] {
    return Object.entries(this.db).map(([uuid, username]) => ({
      uuid,
      username,
      key: uuid,
      type: OFFLINE,
      clientToken: genUUID(),
      accessToken: genUUID(),
      skinUrl: 'https://minotar.net/skin/' + username
    }))
  }
  private save () {
    return fs.writeJson(join(appDir, 'offline.json'), this.db).catch(e => {
      console.error(e)
      throw new Error('保存失败!')
    })
  }
  private check (key: string) {
    if (!(key in this.db)) throw new Error('Account does not exists!')
  }
}
