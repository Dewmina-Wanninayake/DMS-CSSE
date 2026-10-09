import type { Request, Response } from 'express';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { ReportPhotoService } from '../services/report-photo.service';

const reportId = (req: Request): number => (req.validated.params as { id: number }).id;

/** HTTP adapter for the photo of a report; the body is raw image bytes, not JSON. */
export class PhotoController {
  constructor(private readonly photos: ReportPhotoService) {}

  put = (req: Request, res: Response): void => {
    // body-parser leaves `req.body` unset when there is no body or the type is not an image.
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    sendOk(
      res,
      this.photos.attach(currentUser(req), reportId(req), bytes, req.header('content-type')),
    );
  };

  get = (req: Request, res: Response): void => {
    const photo = this.photos.get(currentUser(req), reportId(req));
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.type(photo.mimeType).send(photo.data);
  };
}
