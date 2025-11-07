import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Comment, CommentDocument } from '@/comments/schemas/comment.schema';
import { CreateCommentDto } from '@/comments/dto/create-comment.dto';
import { QueryCommentDto } from '@/comments/dto/query-comment.dto';
import { Anime, AnimeDocument } from '@/anime/schemas/anime.schema';
import { Episode, EpisodeDocument } from '@/episodes/schemas/episode.schema';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Anime.name)
    private readonly animeModel: Model<AnimeDocument>,
    @InjectModel(Episode.name)
    private readonly episodeModel: Model<EpisodeDocument>,
  ) {}

  async createAnimeComment(userId: string, animeId: string, dto: CreateCommentDto) {
    // Validate anime exists
    const anime = await this.animeModel.findById(animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    // Validate parent comment if provided
    if (dto.parentId) {
      const parent = await this.commentModel.findById(dto.parentId).lean().exec();
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (parent.animeId?.toString() !== animeId) {
        throw new BadRequestException('Parent comment does not belong to this anime');
      }
    }

    const comment = await this.commentModel.create({
      userId,
      animeId,
      episodeId: undefined,
      parentId: dto.parentId,
      content: dto.content,
    });

    return comment.toObject();
  }

  async createEpisodeComment(userId: string, episodeId: string, dto: CreateCommentDto) {
    // Validate episode exists
    const episode = await this.episodeModel.findById(episodeId).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    // Validate parent comment if provided
    if (dto.parentId) {
      const parent = await this.commentModel.findById(dto.parentId).lean().exec();
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (parent.episodeId?.toString() !== episodeId) {
        throw new BadRequestException('Parent comment does not belong to this episode');
      }
    }

    const comment = await this.commentModel.create({
      userId,
      animeId: episode.animeId,
      episodeId,
      parentId: dto.parentId,
      content: dto.content,
    });

    return comment.toObject();
  }

  async getAnimeComments(animeId: string, query: QueryCommentDto) {
    // Validate anime exists
    const anime = await this.animeModel.findById(animeId).lean().exec();
    if (!anime) throw new NotFoundException('Anime not found');

    const offset = query.offset || 0;
    const limit = query.limit || 20;

    // Get top-level comments (no parentId)
    const filter: FilterQuery<CommentDocument> = { animeId, parentId: null };

    const [items, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('userId', 'username email')
        .lean()
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      items.map(async (comment) => {
        const replies = await this.commentModel
          .find({ parentId: comment._id })
          .sort({ createdAt: 1 })
          .populate('userId', 'username email')
          .lean()
          .exec();
        return { ...comment, replies };
      }),
    );

    return { items: commentsWithReplies, total };
  }

  async getEpisodeComments(episodeId: string, query: QueryCommentDto) {
    // Validate episode exists
    const episode = await this.episodeModel.findById(episodeId).lean().exec();
    if (!episode) throw new NotFoundException('Episode not found');

    const offset = query.offset || 0;
    const limit = query.limit || 20;

    // Get top-level comments (no parentId)
    const filter: FilterQuery<CommentDocument> = { episodeId, parentId: null };

    const [items, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('userId', 'username email')
        .lean()
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      items.map(async (comment) => {
        const replies = await this.commentModel
          .find({ parentId: comment._id })
          .sort({ createdAt: 1 })
          .populate('userId', 'username email')
          .lean()
          .exec();
        return { ...comment, replies };
      }),
    );

    return { items: commentsWithReplies, total };
  }

  async likeComment(commentId: string) {
    const comment = await this.commentModel.findByIdAndUpdate(
      commentId,
      { $inc: { likes: 1 } },
      { new: true },
    ).lean().exec();

    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}

