import fastify, { FastifyInstance } from "fastify";
import mkdirp from 'mkdirp';

import { keygen } from 'tls-keygen';

import fastifyStatic from "@fastify/static";
import { existsSync, readFileSync } from "fs";
import { BaseUcpComponent, DefaultUcpModel, UcpModel, UcpModelProxySchema, z } from "ior:esm:/tla.EAM.UcpComponent[main]";
import path from "path";
import OnceWebserver from "../3_services/OnceWebserver.interface.mjs";
import { ServerSideUcpComponentDescriptorInterface } from "ior:esm:/tla.EAM.Once[dev]";

const modelSchema =
  z.object({
    port: z.number(),
  }).merge(BaseUcpComponent.modelSchema).merge(UcpModelProxySchema);

type ModelDataType = z.infer<typeof modelSchema>


export default class DefaultOnceWebserver extends BaseUcpComponent<ModelDataType, OnceWebserver> implements OnceWebserver {



  static get modelSchema() {
    return modelSchema;
  }

  public readonly ucpModel: UcpModel = new DefaultUcpModel<ModelDataType, OnceWebserver>(DefaultOnceWebserver.modelDefaultData, this);


  static get modelDefaultData() {
    return {
      ...super.modelDefaultData,
      port: 3000
    }
  }

  private _server: any;

  get tlsPath(): string {
    return path.join(ONCE.eamd.scenario.eamdPath, ONCE.eamd.scenario.scenarioPath, (this.classDescriptor.ucpComponentDescriptor as ServerSideUcpComponentDescriptorInterface).scenarioDirectory, 'tls')
  }

  get tlsKeyPath(): string {
    return path.join(this.tlsPath, 'key.pem');
  }

  get tlsCertPath(): string {
    return path.join(this.tlsPath, 'cert.pem');
  }

  async start(): Promise<void> {

    let scenario = ONCE.eamd.scenario;
    const tlsPaths = { key: this.tlsKeyPath, cert: this.tlsCertPath }


    if (scenario.name === "localhost") {
      if (!existsSync(tlsPaths.key)) {
        await mkdirp(path.dirname(tlsPaths.key))
        await keygen({ ...tlsPaths, entrust: false });
      }
    }

    let server = fastify({
      logger: true,
      http2: true,
      https: {
        allowHTTP1: true, // fallback support for HTTP1
        key: readFileSync(tlsPaths.key),
        cert: readFileSync(tlsPaths.cert)
      }
    });


    let webRoot = path.join(scenario.eamdPath, scenario.webRoot);

    server.register(fastifyStatic, {
      root: webRoot,
      prefix: '/' + webRoot.split('/').pop() + '/',
      index: false,
      list: {
        format: 'html',
        render: this.buildDirectoryPage
      }
    })

    try {
      server.listen({ port: this.model.port })

    } catch (err) {
      console.error(err);
    }
    this._server = server;
    console.log("ONCE STARTED AS NODE_JS WITH EXTERNAL MODULE");
  }

  buildDirectoryPage(dirs: { href: string, name: string }[], files: { href: string, name: string }[]) {
    this;

    const format = (type: 'file' | 'dir', object: { href: string, name: string }): string => {
      let result = '<div style="display:flex; margin-top:5px;"><div style="margin-right: 16px">'
      if (type === 'file') {
        result += `<svg aria-label="File" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" >
        <path fill-rule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5H3.75zm6.75.062V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013l-2.914-2.914a.272.272 0 00-.013-.011zM2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z"></path>
        </svg>`
      } else {
        result += `<svg aria-label="Directory" aria - hidden="true" height = "16" viewBox = "0 0 16 16" version = "1.1" width = "16" style="color: #54aeff; fill: currentColor">
        <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" > </path>
        </svg>`
      }
      result += `</div><div> <a href="${object.href}" > ${object.name} </a></div></div>`
      return result;
    }

    return `
<html><body>
    <div style="display:block; font-family: sans-serif;">
    ${dirs.map(format.bind(this, 'dir')).join('\n  ')}
    ${files.map(format.bind(this, 'file')).join('\n  ')}
    </div>

</body></html>
`
  }
}
